"""Embeddable website generation component.

Exposes AgentSite's pipeline as standalone async functions for
integration into host applications (e.g., CachiBot).

No server, database, or frontend required — just the engine.

Usage::

    from agentsite.engine.component import generate_website, GenerationConfig

    result = await generate_website(
        "A dark-themed portfolio with projects and contact page",
        output_dir=Path("./websites"),
        config=GenerationConfig(model="openai/gpt-4o"),
        on_event=my_progress_callback,
    )

    for path, html in result.files_content.items():
        print(f"{path}: {len(html)} bytes")
"""

from __future__ import annotations

import asyncio
import json
import logging
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from ..models import AgentConfig, AgentRun, Project, StyleSpec, WSEvent
from .project_manager import ProjectManager

logger = logging.getLogger("agentsite.component")

# ---------------------------------------------------------------------------
# Public types
# ---------------------------------------------------------------------------

EventCallback = Callable[[WSEvent], Any]
"""Callback for real-time progress events.

Can be sync or async — the component handles both transparently.
"""


@dataclass
class GenerationConfig:
    """Configuration for a website generation run.

    All fields are optional with sensible defaults.
    """

    model: str = "openai/gpt-4o"
    max_cost: float | None = None
    budget_policy: str | None = None
    provider_keys: dict[str, str] | None = None
    agent_configs: dict[str, AgentConfig] | None = None
    style_spec: StyleSpec | None = None
    logo_url: str = ""
    icon_url: str = ""
    max_review_iterations: int | None = None
    review_threshold: int | None = None
    cancel_event: asyncio.Event | None = None
    conversation_context: str = ""


@dataclass
class GenerationResult:
    """Result of a website generation run."""

    project_id: str
    slug: str
    version: int
    files: list[str]
    files_content: dict[str, str]
    output_dir: Path
    usage: dict[str, Any] = field(default_factory=dict)
    agent_runs: list[dict[str, Any]] = field(default_factory=list)
    style_spec: StyleSpec | None = None
    site_plan_raw: str = ""
    success: bool = True
    error: str | None = None


@dataclass
class ConversationMessage:
    """A single message in a project's conversation history."""

    role: str  # "user" or "assistant"
    content: str  # Human-readable text
    timestamp: str  # ISO 8601 UTC
    meta: dict[str, Any] = field(default_factory=dict)


@dataclass
class PageState:
    """Snapshot of a single page's latest version."""

    slug: str
    latest_version: int
    files: list[str]
    files_content: dict[str, str]


@dataclass
class ProjectState:
    """Full restorable state of a project."""

    project_id: str
    name: str
    model: str
    style_spec: StyleSpec | None
    site_plan_raw: str
    pages: list[PageState]
    messages: list[ConversationMessage]


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _wrap_event_callback(on_event: EventCallback | None) -> Callable[[WSEvent], Awaitable[None]]:
    """Wrap a sync-or-async event callback into a guaranteed async one."""

    async def _emit(event: WSEvent) -> None:
        if on_event is None:
            return
        result = on_event(event)
        if asyncio.iscoroutine(result) or asyncio.isfuture(result):
            await result

    return _emit


def _parse_style_spec(raw_text: str, model: str) -> StyleSpec | None:
    """Try to parse a StyleSpec from raw agent output text."""
    if not raw_text:
        return None
    try:
        from prompture import clean_json_text

        cleaned = clean_json_text(raw_text)
        data = json.loads(cleaned)
        return StyleSpec.model_validate(data)
    except Exception:
        logger.debug("JSON parse of StyleSpec failed, trying extract fallback")

    # Async extraction not possible in a sync helper — caller handles fallback
    return None


async def _parse_style_spec_with_fallback(raw_text: str, model: str) -> StyleSpec | None:
    """Parse StyleSpec with LLM extraction fallback."""
    result = _parse_style_spec(raw_text, model)
    if result is not None:
        return result

    if not raw_text:
        return None

    try:
        from .extract import extract_structured

        return await extract_structured(
            StyleSpec,
            raw_text,
            model,
            instruction="Extract the design style specification from this output:",
        )
    except Exception:
        logger.warning("Failed to extract StyleSpec via LLM fallback", exc_info=True)
        return None


def _collect_files(pm: ProjectManager, project_id: str, slug: str, version: int) -> tuple[list[str], dict[str, str]]:
    """Read all generated files from disk."""
    files = pm.list_version_files(project_id, slug, version)
    files_content: dict[str, str] = {}
    for fpath in files:
        content = pm.read_version_file(project_id, slug, version, fpath)
        if content is not None:
            files_content[fpath] = content
    return files, files_content


def _next_version(pm: ProjectManager, project_id: str, slug: str) -> int:
    """Detect the next version number for a page."""
    page_dir = pm.page_dir(project_id, slug)
    if not page_dir.exists():
        return 1
    existing = sorted(
        int(d.name[1:])
        for d in page_dir.iterdir()
        if d.is_dir() and d.name.startswith("v") and d.name[1:].isdigit()
    )
    return (existing[-1] + 1) if existing else 1


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


async def generate_website(
    prompt: str,
    *,
    output_dir: Path,
    config: GenerationConfig | None = None,
    on_event: EventCallback | None = None,
    project_name: str = "Generated Site",
    slug: str = "index",
) -> GenerationResult:
    """Generate a website from a text prompt.

    This is the main entry point for embedding AgentSite in a host
    application. No server or database required.

    Args:
        prompt: Description of the website to generate.
        output_dir: Base directory to write project files into.
        config: Generation settings (model, budget, keys, etc.).
        on_event: Callback for real-time progress events (sync or async).
        project_name: Name for the generated project.
        slug: Page slug to generate (default: "index").

    Returns:
        GenerationResult with file paths, content, and usage data.
    """
    cfg = config or GenerationConfig()

    pm = ProjectManager(base_dir=output_dir)
    project = Project(
        name=project_name,
        model=cfg.model,
        style_spec=cfg.style_spec,
        logo_url=cfg.logo_url,
        icon_url=cfg.icon_url,
        provider_keys=cfg.provider_keys,
    )
    pm.create(project)

    return await _run_pipeline(
        pm=pm,
        project=project,
        slug=slug,
        version=1,
        prompt=prompt,
        config=cfg,
        on_event=on_event,
    )


async def regenerate_page(
    prompt: str,
    *,
    output_dir: Path,
    project_id: str,
    slug: str = "index",
    version: int | None = None,
    config: GenerationConfig | None = None,
    on_event: EventCallback | None = None,
) -> GenerationResult:
    """Regenerate a page in an existing project.

    Creates a new version, preserving previous ones.

    Args:
        prompt: Updated description or iteration feedback.
        output_dir: Base directory containing the project.
        project_id: Existing project ID.
        slug: Page slug to regenerate.
        version: Explicit version number (auto-increments if None).
        config: Generation settings.
        on_event: Progress event callback.

    Returns:
        GenerationResult for the new version.
    """
    cfg = config or GenerationConfig()
    pm = ProjectManager(base_dir=output_dir)

    project = pm.load_metadata(project_id)
    if project is None:
        return GenerationResult(
            project_id=project_id,
            slug=slug,
            version=version or 1,
            files=[],
            files_content={},
            output_dir=pm.version_dir(project_id, slug, version or 1),
            success=False,
            error=f"Project '{project_id}' not found in {output_dir}",
        )

    # Apply config overrides to existing project
    if cfg.model:
        project.model = cfg.model
    if cfg.style_spec:
        project.style_spec = cfg.style_spec
    if cfg.logo_url:
        project.logo_url = cfg.logo_url
    if cfg.icon_url:
        project.icon_url = cfg.icon_url

    if version is None:
        version = _next_version(pm, project_id, slug)

    return await _run_pipeline(
        pm=pm,
        project=project,
        slug=slug,
        version=version,
        prompt=prompt,
        config=cfg,
        on_event=on_event,
    )


def load_project(output_dir: Path, project_id: str) -> ProjectState | None:
    """Load a project's full state from disk.

    Returns the project metadata, conversation history, site plan,
    and latest version of every page — ready to continue where you
    left off.

    Returns ``None`` if the project directory does not exist.
    """
    pm = ProjectManager(base_dir=output_dir)
    project = pm.load_metadata(project_id)
    if project is None:
        return None

    # Conversation history
    raw_messages = pm.load_messages(project_id)
    messages = [
        ConversationMessage(
            role=m["role"],
            content=m["content"],
            timestamp=m["timestamp"],
            meta=m.get("meta", {}),
        )
        for m in raw_messages
    ]

    # Site plan
    site_plan_raw = pm.read_guide(project_id, "site-plan.json") or ""

    # Enumerate pages — latest version per slug
    pages: list[PageState] = []
    pages_dir = pm.pages_dir(project_id)
    if pages_dir.exists():
        for slug_dir in sorted(pages_dir.iterdir()):
            if not slug_dir.is_dir():
                continue
            slug = slug_dir.name
            versions = sorted(
                int(d.name[1:])
                for d in slug_dir.iterdir()
                if d.is_dir() and d.name.startswith("v") and d.name[1:].isdigit()
            )
            if not versions:
                continue
            latest = versions[-1]
            files, files_content = _collect_files(pm, project_id, slug, latest)
            pages.append(PageState(
                slug=slug,
                latest_version=latest,
                files=files,
                files_content=files_content,
            ))

    # Parse style_spec from project metadata
    style_spec = project.style_spec

    return ProjectState(
        project_id=project.id,
        name=project.name,
        model=project.model or "",
        style_spec=style_spec,
        site_plan_raw=site_plan_raw,
        pages=pages,
        messages=messages,
    )


def delete_project(output_dir: Path, project_id: str) -> bool:
    """Delete a project and all its files from disk.

    Returns ``True`` if the project existed and was removed,
    ``False`` if it was not found.
    """
    pm = ProjectManager(base_dir=output_dir)
    project = pm.load_metadata(project_id)
    if project is None:
        return False
    pm.delete(project_id)
    return True


async def _run_pipeline(
    *,
    pm: ProjectManager,
    project: Project,
    slug: str,
    version: int,
    prompt: str,
    config: GenerationConfig,
    on_event: EventCallback | None,
) -> GenerationResult:
    """Core pipeline runner shared by generate and regenerate."""
    from .pipeline import GenerationPipeline

    emit = _wrap_event_callback(on_event)

    # Import BudgetExceededError with fallback
    try:
        from prompture.exceptions import BudgetExceededError
    except ImportError:
        class BudgetExceededError(Exception):  # type: ignore[no-redef]
            pass

    pipeline = GenerationPipeline(
        pm,
        on_event=emit,
        agent_configs=config.agent_configs,
        provider_keys=config.provider_keys,
    )

    # Persist user message
    action = "generate" if version == 1 else "regenerate"
    pm.append_message(
        project.id,
        ConversationMessage(
            role="user",
            content=prompt,
            timestamp=datetime.now(timezone.utc).isoformat(),
            meta={"slug": slug, "version": version, "action": action},
        ),
    )

    # Prepend conversation context to prompt for iterative development
    effective_prompt = prompt
    if config.conversation_context:
        effective_prompt = (
            f"Previous conversation context:\n{config.conversation_context}\n\n"
            f"Current request:\n{prompt}"
        )

    try:
        # Check cancellation before starting
        if config.cancel_event and config.cancel_event.is_set():
            pm.append_message(
                project.id,
                ConversationMessage(
                    role="assistant",
                    content="Generation cancelled before starting",
                    timestamp=datetime.now(timezone.utc).isoformat(),
                    meta={"slug": slug, "version": version, "action": "cancelled"},
                ),
            )
            return GenerationResult(
                project_id=project.id,
                slug=slug,
                version=version,
                files=[],
                files_content={},
                output_dir=pm.version_dir(project.id, slug, version),
                success=False,
                error="Cancelled by host",
            )

        result = await pipeline.generate(
            project,
            slug=slug,
            version_number=version,
            page_prompt=effective_prompt,
            max_cost=config.max_cost,
            budget_policy=config.budget_policy,
            max_review_iterations=config.max_review_iterations,
            review_threshold=config.review_threshold,
            cancel_event=config.cancel_event,
            conversation_context=config.conversation_context,
        )

        # Auto-save StyleSpec back to project.json on disk
        parsed_ss = None
        if pipeline.style_spec_text:
            parsed_ss = await _parse_style_spec_with_fallback(
                pipeline.style_spec_text,
                project.model or config.model,
            )
            if parsed_ss:
                project.style_spec = parsed_ss
                pm.save_metadata(project)

        files, files_content = _collect_files(pm, project.id, slug, version)

        # Persist assistant message
        pm.append_message(
            project.id,
            ConversationMessage(
                role="assistant",
                content=f"Generated '{slug}' page (v{version}) with {len(files)} files",
                timestamp=datetime.now(timezone.utc).isoformat(),
                meta={"slug": slug, "version": version, "files": files, "success": True},
            ),
        )

        return GenerationResult(
            project_id=project.id,
            slug=slug,
            version=version,
            files=files,
            files_content=files_content,
            output_dir=pm.version_dir(project.id, slug, version),
            usage=getattr(result, "aggregate_usage", {}),
            agent_runs=[r.model_dump() for r in pipeline.agent_runs],
            style_spec=parsed_ss or project.style_spec,
            site_plan_raw=pipeline.site_plan_text,
            success=getattr(result, "success", True),
        )

    except BudgetExceededError as exc:
        logger.warning("Budget exceeded: %s", exc)

        # Recover any files written before budget was hit
        files, files_content = _collect_files(pm, project.id, slug, version)

        await emit(WSEvent(
            type="budget_exceeded",
            data={
                "message": str(exc),
                "slug": slug,
                "version": version,
                "files_recovered": len(files),
            },
        ))

        # Persist assistant message (budget exceeded)
        pm.append_message(
            project.id,
            ConversationMessage(
                role="assistant",
                content=f"Budget exceeded while generating '{slug}' (v{version}), {len(files)} files recovered",
                timestamp=datetime.now(timezone.utc).isoformat(),
                meta={"slug": slug, "version": version, "files": files, "success": bool(files), "error": str(exc)},
            ),
        )

        return GenerationResult(
            project_id=project.id,
            slug=slug,
            version=version,
            files=files,
            files_content=files_content,
            output_dir=pm.version_dir(project.id, slug, version),
            usage={},
            agent_runs=[r.model_dump() for r in pipeline.agent_runs],
            success=bool(files),
            error=str(exc),
        )

    except Exception as exc:
        logger.exception("Generation failed for project %s page %s v%d", project.id, slug, version)

        # Check if files were written despite the error
        files, files_content = _collect_files(pm, project.id, slug, version)

        # Persist assistant message (error)
        pm.append_message(
            project.id,
            ConversationMessage(
                role="assistant",
                content=f"Generation failed for '{slug}' (v{version}): {exc}",
                timestamp=datetime.now(timezone.utc).isoformat(),
                meta={"slug": slug, "version": version, "files": files, "success": bool(files), "error": str(exc)},
            ),
        )

        return GenerationResult(
            project_id=project.id,
            slug=slug,
            version=version,
            files=files,
            files_content=files_content,
            output_dir=pm.version_dir(project.id, slug, version),
            usage={},
            agent_runs=[r.model_dump() for r in pipeline.agent_runs],
            success=bool(files),
            error=str(exc) if not files else None,
        )
