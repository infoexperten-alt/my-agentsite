"""Generation endpoints — POST trigger + WebSocket progress."""

from __future__ import annotations

import asyncio
import logging
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

from ...engine.pipeline import GenerationPipeline
from ...models import Page, PageVersion
from ..deps import get_agent_config_repo, get_agent_run_repo, get_page_repo, get_pm, get_repo, get_version_repo
from ..websocket import ws_manager

logger = logging.getLogger("agentsite.api.generate")
router = APIRouter(tags=["generate"])

# Thread pool for running sync Prompture pipelines
_executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="agentsite-gen")


class GenerateRequest(BaseModel):
    prompt: str = ""
    model: str = ""


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

    # Get event loop for WS bridge
    loop = asyncio.get_running_loop()
    on_event = ws_manager.make_callback(project_id, loop)

    # Load agent configs from DB for pipeline customization
    configs_list = await agent_config_repo.list_all()
    agent_configs = {c.agent_name: c for c in configs_list}

    # Build pipeline
    pipeline = GenerationPipeline(pm, on_event=on_event, agent_configs=agent_configs)

    # Run in thread pool (Prompture groups are synchronous)
    async def _run():
        try:
            result = await loop.run_in_executor(
                _executor,
                lambda: pipeline.generate(
                    project,
                    slug=slug,
                    version_number=version_number,
                    page_prompt=prompt,
                ),
            )
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
        while True:
            # Keep connection alive, handle client messages if needed
            data = await ws.receive_text()
            # Client can send control messages (future: cancel, etc.)
    except WebSocketDisconnect:
        ws_manager.disconnect(project_id, ws)
