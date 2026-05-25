"""Chat agent endpoint — POST /api/projects/{id}/pages/{slug}/chat/stream.

Delegates to ``prompture.AsyncAgent.run_live()`` for a true streaming chat
with tool calling. The agent's tool registry lets it kick off page
generation, steer in-flight builds, and inspect generated files.

Each call is stateless to the agent (no prior-message context). The
``ChatMessage`` table only persists history for UI display.
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from prompture import (
    AssistantTurnStart,
    AsyncAgent,
    MessageStop,
    TextDelta,
    ThinkingDelta,
    ToolInputDelta,
    ToolResult as LiveToolResult,
    ToolUseStart,
    ToolUseStop,
    TurnComplete,
)
from pydantic import BaseModel

from ...agents.chat_tools import chat_registry, edit_registry
from ...models import ChatMessage
from ..deps import (
    get_agent_config_repo,
    get_agent_run_repo,
    get_message_repo,
    get_page_repo,
    get_pm,
    get_repo,
    get_version_repo,
)

logger = logging.getLogger("agentsite.api.chat")
router = APIRouter(tags=["chat"])


DEFAULT_SYSTEM_PROMPT = (
    "You are the AgentSite build assistant — a senior project manager "
    "wired directly into a multi-agent website-generation pipeline.\n\n"
    "The user is editing the page slug given to you in their first message. "
    "You can:\n"
    "  - Start a build with `start_build(prompt, page_slug, audience, "
    "visual_tone, direction_id, constraints)`.\n"
    "  - Steer an in-flight build with `steer_build(instruction)`.\n"
    "  - Inspect existing pages with `list_pages`, `list_versions`, "
    "`get_build_status`, `read_page_file`.\n\n"
    "**Brief inference is your job.** When the user asks to build "
    "something, infer `audience` and `visual_tone` from the project "
    "name and prompt before calling `start_build`. Examples:\n"
    "  - 'Portfolio for a senior backend engineer' → "
    "audience='technical hiring managers', "
    "visual_tone=['tech_utility','modern_minimal'].\n"
    "  - 'Magazine landing for indie writers' → visual_tone=['editorial'].\n"
    "  - 'Booking platform for premium charter services' → "
    "audience='customers booking high-end charters', "
    "visual_tone=['luxury','modern_minimal'].\n"
    "Never call `start_build` with empty audience/visual_tone unless the "
    "user truly gave you nothing to go on — empty brief forces the "
    "pipeline to guess and often produces off-brand output.\n"
    "Allowed visual_tone values: 'editorial', 'modern_minimal', "
    "'playful', 'tech_utility', 'luxury', 'brutalist', 'human'.\n\n"
    "Be concise. When the user asks to build, create, or generate something, "
    "call `start_build` rather than just describing what you would do. When "
    "they're refining mid-build, use `steer_build` so the change reaches the "
    "running pipeline. Do not narrate tool calls — just make them."
)


EDIT_MODE_SYSTEM_PROMPT = (
    "You are AgentSite's visual edit assistant. The user has the visual "
    "editor open and is asking you to TWEAK what they have selected — "
    "not rebuild the page.\n\n"
    "Available tools:\n"
    "  • patch — apply a visual edit (the only mutation tool)\n"
    "  • find(selector, limit=20) — list elements matching a CSS selector\n"
    "  • get_tree(id, depth=2) — structural tree of an element's descendants\n"
    "  • find_closest(from_id, selector) — walk up to the nearest matching ancestor\n"
    "  • get_parent(id) / get_children(id) — immediate relatives\n"
    "  • list_blocks — discover reusable blocks (hero / CTA / feature grid / quote)\n"
    "  • render_block(block_id, config) — render a block to HTML, then patch it in\n"
    "  • read_page_file — read raw file contents\n\n"
    "Use the `patch` tool to apply changes. One call per logical change. "
    "Examples:\n"
    "  - 'make it blue and bigger' → patch(kind='set-style', id=<selected.id>, "
    "styles={'color': '#2563eb', 'font-size': '20px'})\n"
    "  - 'change the text to Get Started' → patch(kind='set-text', "
    "id=<selected.id>, value='Get Started')\n"
    "  - 'make the button rounded' → patch(kind='set-style', id=<selected.id>, "
    "styles={'border-radius': '9999px'})\n"
    "  - 'open this link in a new tab' → patch(kind='set-attributes', "
    "id=<selected.id>, attributes={'target': '_blank', 'rel': 'noopener'})\n\n"
    "BULK EDITS — when the user says 'all the buttons' / 'every card' / "
    "'each section heading', FIRST call `find` to get the list of ids, "
    "THEN call `patch` once per id. Example: 'make all the buttons rounded' "
    "→ find('button') → for each result, patch(kind='set-style', id=<r.id>, "
    "styles={'border-radius': '9999px'}).\n\n"
    "ALWAYS pull the target id from the [Selected: ...] header in the "
    "user's message OR from a previous `find` / `get_tree` / `get_parent` "
    "result. Never invent ids.\n\n"
    "If the user references 'this section' or 'the parent', use "
    "`find_closest` or `get_parent` to resolve before patching.\n\n"
    "INSERTING BLOCKS — when the user asks for a new section (hero, CTA "
    "banner, feature grid, testimonial, pricing table…) PREFER inserting "
    "a pre-built block over writing markup from scratch. Flow:\n"
    "  1. list_blocks → see what's available\n"
    "  2. render_block(block_id, {field: value, …}) → get HTML\n"
    "  3. patch(kind='set-outer-html', id=<target>, html=<rendered>) — "
    "where <target> is the element the new block should REPLACE; or wrap "
    "the existing element + new block via set-outer-html if you're "
    "adding rather than replacing.\n\n"
    "If the user asks for something that needs new markup but no block "
    "fits (e.g. 'add an icon next to the text'), use set-outer-html "
    "with the current element wrapped/extended.\n\n"
    "If nothing is selected and the request is element-specific (not a "
    "bulk operation), ASK the user to click the element they want to "
    "change — do not guess.\n\n"
    "NEVER call start_build — the user is not asking for a rebuild. If "
    "they want a full redesign, tell them to exit edit mode first.\n"
    "NEVER narrate what you are about to do — just make the calls. After "
    "patching, one short sentence confirming what changed is fine."
)


class EditContext(BaseModel):
    mode: bool = False
    version: int | None = None
    selection: dict[str, Any] | None = None
    selections: list[dict[str, Any]] = []  # multi-select via shift-click


class ChatRequest(BaseModel):
    message: str
    model: str = ""
    edit_context: EditContext | None = None


def _sse(payload: dict[str, Any]) -> str:
    return f"data: {json.dumps(payload)}\n\n"


@router.post("/api/projects/{project_id}/pages/{slug}/chat/stream")
async def chat_stream(
    project_id: str,
    slug: str,
    req: ChatRequest,
    repo=Depends(get_repo),
    page_repo=Depends(get_page_repo),
    version_repo=Depends(get_version_repo),
    agent_config_repo=Depends(get_agent_config_repo),
    agent_run_repo=Depends(get_agent_run_repo),
    message_repo=Depends(get_message_repo),
    pm=Depends(get_pm),
):
    """Stream chat-agent events as SSE frames."""
    message = (req.message or "").strip()
    if not message:
        raise HTTPException(status_code=400, detail="message is required")

    project = await repo.get(project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    model = req.model or project.model or "openai/gpt-4o"

    # Provider keys: inject project-level overrides into the env so the
    # driver sees them. (Same trick the generation pipeline uses.)
    if project.provider_keys:
        for key, value in project.provider_keys.items():
            if value:
                os.environ[key] = value

    # Ensure page exists so messages can be attached to it.
    page = await page_repo.get_by_slug(project_id, slug)
    if page is None:
        from ...models import Page
        page = Page(
            project_id=project_id,
            slug=slug,
            title=slug.replace("-", " ").title(),
        )
        await page_repo.create(page)

    # Persist the user message up front so it survives a dropped stream.
    user_msg = ChatMessage(page_id=page.id, role="user", content=message)
    await message_repo.create(user_msg)

    agent_deps = {
        "project_id": project_id,
        "current_page_slug": slug,
        "project_repo": repo,
        "page_repo": page_repo,
        "version_repo": version_repo,
        "agent_config_repo": agent_config_repo,
        "agent_run_repo": agent_run_repo,
        "pm": pm,
        "model": model,
        "provider_keys": dict(project.provider_keys or {}),
    }

    edit_ctx = req.edit_context
    in_edit_mode = bool(edit_ctx and edit_ctx.mode)

    if in_edit_mode:
        # Expose edit context to discovery tools (find / get_tree / etc.)
        agent_deps["edit_context"] = edit_ctx.model_dump() if edit_ctx else {}
        header_parts = [f"[Project: {project_id} | Current page: {slug} | Edit mode]"]
        multi = edit_ctx.selections if edit_ctx and edit_ctx.selections else []
        sel = edit_ctx.selection if edit_ctx else None
        if multi:
            ids = [s.get("id", "?") for s in multi]
            tags = sorted({s.get("tag", "?") for s in multi})
            header_parts.append(
                f"[Multi-selected: {len(multi)} elements | tags={','.join(tags)} | "
                f"ids={', '.join(ids[:10])}{'…' if len(ids) > 10 else ''}]"
            )
            header_parts.append(
                "Apply one `patch` per id when the user asks for a bulk change."
            )
        elif sel:
            header_parts.append(
                f"[Selected: <{sel.get('tag', '?')}> "
                f"id={sel.get('id', '?')} "
                f"kind={sel.get('kind', '?')}]"
            )
            sel_text = sel.get("text")
            if sel_text:
                header_parts.append(f"Current text: {sel_text!r}")
            sel_attrs = (sel.get("attributes") or {})
            sel_style = sel_attrs.get("style")
            if sel_style:
                header_parts.append(f"Current inline style: {sel_style}")
            sel_href = sel_attrs.get("href")
            if sel_href:
                header_parts.append(f"Current href: {sel_href}")
            sel_src = sel_attrs.get("src")
            if sel_src:
                header_parts.append(f"Current image src: {sel_src}")
        else:
            header_parts.append(
                "[Selected: none — ask the user to click an element, "
                "or use `find` if the request is a bulk operation]"
            )
        if edit_ctx and edit_ctx.version is not None:
            header_parts.append(f"[Editing version: v{edit_ctx.version}]")
        framed_prompt = "\n".join(header_parts) + f"\n\n{message}"
        active_registry = edit_registry
        active_system_prompt = EDIT_MODE_SYSTEM_PROMPT
    else:
        framed_prompt = (
            f"[Project: {project_id} | Current page: {slug}]\n\n{message}"
        )
        active_registry = chat_registry
        active_system_prompt = DEFAULT_SYSTEM_PROMPT

    agent = AsyncAgent(
        model=model,
        tools=active_registry,
        system_prompt=active_system_prompt,
        max_iterations=5,
    )

    async def event_stream():
        full_text_parts: list[str] = []
        full_thinking_parts: list[str] = []
        tool_calls: list[dict[str, Any]] = []

        streamed = agent.run_live(framed_prompt, deps=agent_deps)

        try:
            async for event in streamed:
                if isinstance(event, AssistantTurnStart):
                    yield _sse({"type": "turn_start", "turn_index": event.turn_index})
                elif isinstance(event, TextDelta):
                    full_text_parts.append(event.text)
                    yield _sse({"type": "text", "content": event.text})
                elif isinstance(event, ThinkingDelta):
                    full_thinking_parts.append(event.text)
                    yield _sse({"type": "thinking", "content": event.text})
                elif isinstance(event, ToolUseStart):
                    tool_calls.append({"id": event.id, "name": event.name, "input": {}})
                    yield _sse({"type": "tool_call", "id": event.id, "name": event.name})
                elif isinstance(event, ToolInputDelta):
                    yield _sse({
                        "type": "tool_input_delta",
                        "id": event.id,
                        "fragment": event.fragment,
                    })
                elif isinstance(event, ToolUseStop):
                    for tc in tool_calls:
                        if tc["id"] == event.id:
                            tc["input"] = event.input
                            break
                    yield _sse({
                        "type": "tool_use_stop",
                        "id": event.id,
                        "name": event.name,
                        "input": event.input,
                    })
                elif isinstance(event, LiveToolResult):
                    yield _sse({
                        "type": "tool_result",
                        "id": event.id,
                        "name": event.name,
                        "output": event.output[:2000],
                        "is_error": event.is_error,
                    })
                elif isinstance(event, MessageStop):
                    yield _sse({"type": "message_stop", "stop_reason": event.stop_reason})
                elif isinstance(event, TurnComplete):
                    pass

            result_obj = streamed.result
            usage = dict(result_obj.usage or {})
        except Exception as exc:
            logger.exception("chat stream failed")
            yield _sse({"type": "error", "message": str(exc)})
            return

        full_text = "".join(full_text_parts)
        full_thinking = "".join(full_thinking_parts)

        assistant_meta: dict[str, Any] = {"usage": usage}
        if tool_calls:
            assistant_meta["tool_calls"] = tool_calls
        if full_thinking:
            assistant_meta["thinking"] = full_thinking

        assistant_msg = ChatMessage(
            page_id=page.id,
            role="agent",
            content=full_text,
            meta=assistant_meta,
        )
        try:
            await message_repo.create(assistant_msg)
        except Exception:
            logger.warning("Failed to persist assistant message", exc_info=True)

        yield _sse({
            "type": "done",
            "model": model,
            "usage": usage,
            "message_id": assistant_msg.id,
        })

    return StreamingResponse(event_stream(), media_type="text/event-stream")
