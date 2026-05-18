"""Generation endpoints — POST trigger + WebSocket progress."""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

from ...engine.pipeline import GenerationPipeline
from ...models import Page, PageVersion
from ..deps import get_agent_config_repo, get_agent_run_repo, get_page_repo, get_pm, get_repo, get_version_repo
from ..websocket import ws_manager

logger = logging.getLogger("agentsite.api.generate")
router = APIRouter(tags=["generate"])

class GenerateRequest(BaseModel):
    prompt: str = ""
    model: str = ""
    agent_models: dict[str, str] | None = None
    max_cost: float | None = None  # per-request budget override
    budget_policy: str | None = None  # per-request policy override
    provider_keys: dict[str, str] | None = None  # per-request provider key overrides
    discovery_brief: dict | None = None  # Phase 1 — answers from the discovery form
    direction_id: str | None = None  # Phase 2 — chosen design direction id


@router.post("/api/projects/{project_id}/pages/{slug}/generate")
async def start_generation(
    project_id: str,
    slug: str,
    req: GenerateRequest,
    repo=Depends(get_repo),
    page_repo=Depends(get_page_repo),
    version_repo=Depends(get_version_repo),
    pm=Depends(get_pm),
    agent_run_repo=Depends(get_agent_run_repo),
    agent_config_repo=Depends(get_agent_config_repo),
):
    """Start page generation — creates a new version and runs the pipeline."""
    project = await repo.get(project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    # Override model if provided
    if req.model:
        project.model = req.model
        await repo.update(project)

    # Get or create page
    page = await page_repo.get_by_slug(project_id, slug)
    if page is None:
        page = Page(
            project_id=project_id,
            slug=slug,
            title=slug.replace("-", " ").title(),
            prompt=req.prompt,
        )
        await page_repo.create(page)
    elif req.prompt:
        page.prompt = req.prompt
        await page_repo.update(page)

    prompt = req.prompt or page.prompt
    if not prompt:
        raise HTTPException(status_code=400, detail="Prompt is required")

    # Check no version is currently generating for this page
    latest = await version_repo.get_latest(page.id)
    if latest and latest.status == "generating":
        raise HTTPException(status_code=409, detail="Generation already in progress for this page")

    # Create new version
    version_number = await version_repo.next_version_number(page.id)
    version = PageVersion(
        page_id=page.id,
        version_number=version_number,
        status="generating",
        prompt=prompt,
    )
    await version_repo.create(version)

    on_event = ws_manager.make_callback(project_id)

    # Load agent configs from DB for pipeline customization
    configs_list = await agent_config_repo.list_all()
    agent_configs = {c.agent_name: c for c in configs_list}

    # Merge project-level agent overrides (enabled, model, temperature, system_prompt_override)
    if project.agent_overrides:
        from ...models import AgentConfig as AgentConfigModel
        for agent_key, overrides in project.agent_overrides.items():
            if not isinstance(overrides, dict):
                continue
            if agent_key not in agent_configs:
                agent_configs[agent_key] = AgentConfigModel(agent_name=agent_key)
            cfg = agent_configs[agent_key]
            if "enabled" in overrides:
                cfg.enabled = bool(overrides["enabled"])
            if overrides.get("model") and "/" in overrides["model"]:
                cfg.model = overrides["model"]
            if "temperature" in overrides:
                cfg.temperature = float(overrides["temperature"])
            if overrides.get("system_prompt_override"):
                cfg.system_prompt_override = overrides["system_prompt_override"]

    # Merge request-level per-agent model overrides (highest priority)
    if req.agent_models:
        from ...models import AgentConfig as AgentConfigModel
        for agent_key, model_str in req.agent_models.items():
            if model_str and "/" in model_str:
                if agent_key in agent_configs:
                    agent_configs[agent_key].model = model_str
                else:
                    agent_configs[agent_key] = AgentConfigModel(agent_name=agent_key, model=model_str)

    # Merge provider keys: project-level, then request-level overrides
    provider_keys = dict(project.provider_keys or {})
    if req.provider_keys:
        provider_keys.update(req.provider_keys)

    # Build pipeline
    pipeline = GenerationPipeline(
        pm,
        on_event=on_event,
        agent_configs=agent_configs,
        provider_keys=provider_keys or None,
    )

    # Import BudgetExceededError for specific handling (falls back to unusable sentinel)
    try:
        from prompture.exceptions import BudgetExceededError as _BudgetExceededError
    except ImportError:
        class _BudgetExceededError(Exception):  # type: ignore[no-redef]
            """Placeholder — never raised when prompture is missing."""

    # Convert raw discovery answers into a structured DiscoveryBrief
    brief = None
    if req.discovery_brief:
        from ...agents.discovery import brief_from_form
        brief = brief_from_form(req.discovery_brief)

    # Top-level direction_id wins over whatever was in the brief
    if req.direction_id:
        if brief is None:
            from ...models import DiscoveryBrief
            brief = DiscoveryBrief(brand_mode="pick_direction", direction_id=req.direction_id)
        else:
            brief.direction_id = req.direction_id
            if not brief.brand_mode:
                brief.brand_mode = "pick_direction"

    async def _run():
        try:
            result = await pipeline.generate(
                project,
                slug=slug,
                version_number=version_number,
                page_prompt=prompt,
                max_cost=req.max_cost,
                budget_policy=req.budget_policy,
                discovery_brief=brief,
            )
            # Auto-save designer's StyleSpec back to the project
            if pipeline.style_spec_text:
                try:
                    import json as _json

                    from prompture import clean_json_text

                    from ...models import StyleSpec
                    cleaned_ss = clean_json_text(pipeline.style_spec_text)
                    ss_data = _json.loads(cleaned_ss)
                    project.style_spec = StyleSpec.model_validate(ss_data)
                    await repo.update(project)
                except Exception:
                    # Fallback: use extract_with_model to re-extract from raw output
                    from ...engine.extract import extract_structured
                    from ...models import StyleSpec

                    extracted = await extract_structured(
                        StyleSpec,
                        pipeline.style_spec_text,
                        project.model or "openai/gpt-4o",
                        instruction="Extract the design style specification from this output:",
                    )
                    if extracted:
                        project.style_spec = extracted
                        await repo.update(project)
                    else:
                        logger.warning("Failed to auto-save StyleSpec to project", exc_info=True)

            # Read generated files from disk into version record
            file_list = pm.list_version_files(project.id, slug, version_number)
            files_content: dict[str, str] = {}
            for fpath in file_list:
                content = pm.read_version_file(project.id, slug, version_number, fpath)
                if content is not None:
                    files_content[fpath] = content

            # Update version record
            version.status = "completed"
            version.usage = result.aggregate_usage
            version.files = files_content
            version.completed_at = datetime.now(timezone.utc).isoformat()
            await version_repo.update(version)
        except _BudgetExceededError as budget_exc:
            logger.warning(
                "Budget exceeded for project %s page %s: %s",
                project_id, slug, budget_exc,
            )
            # Save any files that were written before budget was hit
            file_list = pm.list_version_files(project.id, slug, version_number)
            files_content: dict[str, str] = {}
            for fpath in file_list:
                content = pm.read_version_file(project.id, slug, version_number, fpath)
                if content is not None:
                    files_content[fpath] = content

            version.status = "budget_exceeded"
            version.error = str(budget_exc)
            version.files = files_content or None
            version.completed_at = datetime.now(timezone.utc).isoformat()
            await version_repo.update(version)

            from ...models import WSEvent
            try:
                await ws_manager.broadcast(
                    project_id,
                    WSEvent(
                        type="budget_exceeded",
                        data={
                            "message": str(budget_exc),
                            "slug": slug,
                            "version": version_number,
                            "files_recovered": len(files_content),
                        },
                    ),
                )
                await ws_manager.broadcast(
                    project_id,
                    WSEvent(
                        type="generation_complete",
                        data={
                            "success": False,
                            "slug": slug,
                            "version": version_number,
                            "files": file_list,
                            "error": str(budget_exc),
                            "budget_exceeded": True,
                        },
                    ),
                )
            except Exception:
                logger.warning("Failed to broadcast budget_exceeded via WebSocket")
        except Exception as exc:
            import traceback as tb_mod
            error_detail = str(exc)
            tb = tb_mod.format_exc()
            logger.exception("Generation failed for project %s page %s", project_id, slug)

            # Check if files were written to disk despite the error
            # (e.g. developer wrote files but reviewer rejection caused a retry that failed)
            file_list = pm.list_version_files(project.id, slug, version_number)
            if file_list:
                logger.info(
                    "Pipeline failed but %d files exist on disk for project %s page %s v%d — marking completed",
                    len(file_list), project_id, slug, version_number,
                )
                files_content: dict[str, str] = {}
                for fpath in file_list:
                    content = pm.read_version_file(project.id, slug, version_number, fpath)
                    if content is not None:
                        files_content[fpath] = content
                version.status = "completed"
                version.files = files_content
                version.completed_at = datetime.now(timezone.utc).isoformat()
                await version_repo.update(version)
            else:
                version.status = "failed"
                version.error = error_detail
                version.completed_at = datetime.now(timezone.utc).isoformat()
                await version_repo.update(version)
            # Broadcast completion/error to WebSocket
            from ...models import WSEvent
            recovered = version.status == "completed"
            try:
                if not recovered:
                    await ws_manager.broadcast(
                        project_id,
                        WSEvent(type="error", data={"message": error_detail, "traceback": tb}),
                    )
                await ws_manager.broadcast(
                    project_id,
                    WSEvent(
                        type="generation_complete",
                        data={
                            "success": recovered,
                            "slug": slug,
                            "version": version_number,
                            "files": file_list if recovered else [],
                            "error": error_detail if not recovered else None,
                        },
                    ),
                )
            except Exception:
                logger.warning("Failed to broadcast via WebSocket")
        finally:
            # Persist agent run records
            for run in pipeline.agent_runs:
                try:
                    await agent_run_repo.create(run)
                except Exception:
                    logger.warning("Failed to persist agent run: %s", run.id)

    # Fire and forget
    asyncio.create_task(_run())

    return {
        "project_id": project_id,
        "slug": slug,
        "version_number": version_number,
        "version_id": version.id,
        "status": "started",
        "message": "Generation started. Connect to WebSocket for progress.",
    }


@router.websocket("/ws/generate/{project_id}")
async def generation_websocket(project_id: str, ws: WebSocket):
    """WebSocket endpoint for real-time generation progress."""
    await ws_manager.connect(project_id, ws)
    try:
        import json as _json

        from ...engine.interrupt import mailbox
        from ...models import WSEvent
        while True:
            data = await ws.receive_text()
            # Phase 7 — inbound steer: {"type": "steer", "text": "..."}.
            try:
                msg = _json.loads(data) if data else {}
            except Exception:
                msg = {}
            if isinstance(msg, dict) and msg.get("type") == "steer":
                text = str(msg.get("text", "")).strip()
                if text:
                    mailbox.deposit(project_id, text)
                    await ws_manager.broadcast(
                        project_id,
                        WSEvent(type="steer_received", data={"text": text, "bytes": len(text)}),
                    )
    except WebSocketDisconnect:
        ws_manager.disconnect(project_id, ws)
