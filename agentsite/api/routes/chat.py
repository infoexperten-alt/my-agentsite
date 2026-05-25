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

from ...agents.chat_tools import chat_registry
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


class ChatRequest(BaseModel):
    message: str
    model: str = ""


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

    framed_prompt = (
        f"[Project: {project_id} | Current page: {slug}]\n\n{message}"
    )

    agent = AsyncAgent(
        model=model,
        tools=chat_registry,
        system_prompt=DEFAULT_SYSTEM_PROMPT,
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
