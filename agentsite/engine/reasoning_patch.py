"""Patch Prompture Conversation to preserve reasoning on assistant messages.

Prompture 0.0.49 stores ``reasoning_content`` on assistant messages only in
the native tool-calling path.  For the simple ``ask()`` and ``ask_for_json()``
paths, reasoning is stored on ``Conversation.last_reasoning`` but **not** on
the message dicts in the history.

This patch ensures ``reasoning_content`` is always written onto the last
assistant message after every ``ask()`` call so that downstream code
(pipeline callbacks, AgentResult.messages) can find it uniformly.
"""

from __future__ import annotations

import logging

logger = logging.getLogger("agentsite.reasoning_patch")


def apply_reasoning_patch() -> None:
    """Monkey-patch ``AsyncConversation.ask`` to store reasoning on messages."""
    from prompture import AsyncConversation

    if getattr(AsyncConversation.ask, "_reasoning_patched", False):
        return

    original_ask = AsyncConversation.ask

    async def _patched_ask(self, content, **kwargs):  # type: ignore[no-untyped-def]
        result = await original_ask(self, content, **kwargs)
        reasoning = self.last_reasoning
        if reasoning:
            # Walk backwards to find the last assistant message and annotate it.
            for msg in reversed(self._messages):
                if msg.get("role") == "assistant" and "reasoning_content" not in msg:
                    msg["reasoning_content"] = reasoning
                    break
        return result

    _patched_ask._reasoning_patched = True  # type: ignore[attr-defined]
    AsyncConversation.ask = _patched_ask  # type: ignore[assignment]
    logger.debug("Reasoning patch applied to AsyncConversation.ask")
