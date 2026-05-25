"""Tools the chat agent uses to drive the build pipeline.

The chat agent (prompture.AsyncAgent) gets this registry. Tools read
their dependencies from ``ctx.deps``, which the chat endpoint populates
with project repos, the project manager, and the current project_id.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from prompture import RunContext, ToolRegistry

from ..engine.generation_runner import start_generation_task
from ..engine.interrupt import mailbox

logger = logging.getLogger("agentsite.chat_tools")


async def start_build(
    ctx: RunContext,
    prompt: str,
    page_slug: str = "home",
    audience: str = "",
    visual_tone: list[str] | None = None,
    direction_id: str | None = None,
    constraints: str = "",
) -> str:
    """Kick off generation of a page from a prompt.

    Use this when the user asks to build, create, or generate a new
    page or site. Returns the version number once the background task
    is scheduled — progress streams over the project's WebSocket.

    ALWAYS populate ``audience`` and ``visual_tone`` from the user's
    request when you can (e.g. a luxury booking landing page →
    audience="premium-charter customers",
    visual_tone=["luxury", "modern_minimal"]).  Empty values force the
    pipeline to guess and often produce off-brand output.

    Args:
        prompt: What the user wants built.
        page_slug: Page identifier (default ``"home"``).
        audience: Who the site is for, in plain language (e.g.
            "premium-charter customers"). Empty when the
            user hasn't said.
        visual_tone: Tone keywords from this fixed set:
            ``"editorial"``, ``"modern_minimal"``, ``"playful"``,
            ``"tech_utility"``, ``"luxury"``, ``"brutalist"``,
            ``"human"``. Pick 1-2.
        direction_id: When the user explicitly named a design direction
            (or the chat surfaced one), the id (e.g.
            ``"modern-minimal"``, ``"luxury-refined"``). When set,
            Prompture synthesises StyleSpec from the direction and
            skips the Designer agent — only use it when the user
            picked a direction.
        constraints: Free-text constraints (deadlines, must-use fonts,
            things to avoid). Empty when none.
    """
    deps: dict[str, Any] = ctx.deps
    project_id = deps.get("project_id")
    if not project_id:
        return "Error: no project_id in context"

    discovery_brief: dict[str, Any] | None = None
    if audience or visual_tone or constraints:
        discovery_brief = {
            "audience": audience,
            "tone": list(visual_tone or []),
            "constraints": constraints,
            "brand_mode": "pick_direction",
        }

    try:
        result = await start_generation_task(
            project_id,
            page_slug,
            prompt,
            project_repo=deps["project_repo"],
            page_repo=deps["page_repo"],
            version_repo=deps["version_repo"],
            agent_config_repo=deps["agent_config_repo"],
            agent_run_repo=deps["agent_run_repo"],
            pm=deps["pm"],
            model=deps.get("model", ""),
            provider_keys=deps.get("provider_keys"),
            discovery_brief=discovery_brief,
            direction_id=direction_id,
        )
    except ValueError as exc:
        return f"Error: {exc}"
    except Exception as exc:
        logger.exception("start_build failed")
        return f"Error starting build: {exc}"

    return json.dumps({
        "status": "started",
        "page_slug": page_slug,
        "version_number": result["version_number"],
        "audience": audience,
        "visual_tone": list(visual_tone or []),
        "direction_id": direction_id,
        "note": "Pipeline running. Progress is broadcast over the WebSocket.",
    })


def steer_build(ctx: RunContext, instruction: str) -> str:
    """Steer the currently-running generation with a tweak.

    Deposits the instruction into the in-memory mailbox the pipeline
    drains between phases. Use this when a build is already running
    and the user wants to refine it (e.g. "make the headline punchier").

    Args:
        instruction: Refinement text to inject into the pipeline.
    """
    project_id = ctx.deps.get("project_id")
    if not project_id:
        return "Error: no project_id in context"
    text = (instruction or "").strip()
    if not text:
        return "Error: instruction is empty"
    mailbox.deposit(project_id, text)
    return f"Steer deposited ({len(text)} chars). Pipeline will pick it up between phases."


async def list_pages(ctx: RunContext) -> str:
    """List all pages in the current project with their slugs and titles."""
    project_id = ctx.deps.get("project_id")
    page_repo = ctx.deps.get("page_repo")
    if not project_id or page_repo is None:
        return "Error: no project context"
    pages = await page_repo.list_by_project(project_id)
    return json.dumps(
        [{"slug": p.slug, "title": p.title, "prompt": p.prompt} for p in pages],
        indent=2,
    )


async def list_versions(ctx: RunContext, page_slug: str = "home") -> str:
    """List all versions of a page with their status and timestamps."""
    project_id = ctx.deps.get("project_id")
    page_repo = ctx.deps.get("page_repo")
    version_repo = ctx.deps.get("version_repo")
    if not project_id or page_repo is None or version_repo is None:
        return "Error: no project context"
    page = await page_repo.get_by_slug(project_id, page_slug)
    if page is None:
        return f"Error: page '{page_slug}' not found"
    versions = await version_repo.list_by_page(page.id)
    return json.dumps(
        [
            {
                "version": v.version_number,
                "status": v.status,
                "completed_at": v.completed_at,
                "files": list((v.files or {}).keys()),
            }
            for v in versions
        ],
        indent=2,
    )


async def read_page_file(
    ctx: RunContext,
    page_slug: str,
    path: str,
    version_number: int = 0,
) -> str:
    """Read a generated file from a page version.

    Args:
        page_slug: Page identifier (e.g. ``"home"``).
        path: File path within the version (e.g. ``"index.html"``).
        version_number: Version to read, or ``0`` for the latest.
    """
    project_id = ctx.deps.get("project_id")
    pm = ctx.deps.get("pm")
    page_repo = ctx.deps.get("page_repo")
    version_repo = ctx.deps.get("version_repo")
    if not project_id or pm is None or page_repo is None or version_repo is None:
        return "Error: no project context"

    page = await page_repo.get_by_slug(project_id, page_slug)
    if page is None:
        return f"Error: page '{page_slug}' not found"

    if version_number == 0:
        latest = await version_repo.get_latest(page.id)
        if latest is None:
            return f"Error: no versions yet for page '{page_slug}'"
        version_number = latest.version_number

    content = pm.read_version_file(project_id, page_slug, version_number, path)
    if content is None:
        return f"Error: file '{path}' not found in {page_slug} v{version_number}"
    return content


async def get_build_status(ctx: RunContext, page_slug: str = "home") -> str:
    """Check whether a build is currently running for a page."""
    project_id = ctx.deps.get("project_id")
    page_repo = ctx.deps.get("page_repo")
    version_repo = ctx.deps.get("version_repo")
    if not project_id or page_repo is None or version_repo is None:
        return "Error: no project context"
    page = await page_repo.get_by_slug(project_id, page_slug)
    if page is None:
        return json.dumps({"page_slug": page_slug, "exists": False})
    latest = await version_repo.get_latest(page.id)
    if latest is None:
        return json.dumps({"page_slug": page_slug, "exists": True, "has_versions": False})
    return json.dumps({
        "page_slug": page_slug,
        "version": latest.version_number,
        "status": latest.status,
        "error": latest.error,
        "completed_at": latest.completed_at,
    })


# ---------------------------------------------------------------------------
# Registry — used by the chat endpoint
# ---------------------------------------------------------------------------

chat_registry = ToolRegistry()
chat_registry.register(start_build)
chat_registry.register(steer_build)
chat_registry.register(list_pages)
chat_registry.register(list_versions)
chat_registry.register(read_page_file)
chat_registry.register(get_build_status)
