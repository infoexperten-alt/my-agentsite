"""Per-project steer mailbox (Phase 7).

A simple in-memory mailbox the WebSocket layer writes to (when the user sends
an inbound `{type: "steer", text: "..."}` frame) and the generation pipeline
drains between steps. Steer payloads are accumulated in order so multiple
in-flight tweaks survive a single check.

Scoped to the process — fine for the single-user local model. When AgentSite
goes multi-process, swap the dict for a Redis pub/sub.
"""

from __future__ import annotations

import asyncio
import logging
from collections import defaultdict

logger = logging.getLogger("agentsite.interrupt")


class SteerMailbox:
    def __init__(self) -> None:
        self._queues: dict[str, asyncio.Queue[str]] = defaultdict(asyncio.Queue)

    def deposit(self, project_id: str, text: str) -> None:
        """Non-blocking deposit — safe to call from any context (incl. WS handler)."""
        if not text:
            return
        try:
            self._queues[project_id].put_nowait(text)
            logger.debug("steer deposited for %s (%d chars)", project_id, len(text))
        except asyncio.QueueFull:  # unbounded by default, but be defensive
            logger.warning("steer mailbox full for %s — dropping", project_id)

    def drain(self, project_id: str) -> list[str]:
        """Pop all pending steer messages for a project. Returns [] when empty."""
        q = self._queues.get(project_id)
        if q is None:
            return []
        out: list[str] = []
        while not q.empty():
            try:
                out.append(q.get_nowait())
            except asyncio.QueueEmpty:
                break
        return out

    def clear(self, project_id: str) -> None:
        self._queues.pop(project_id, None)


mailbox = SteerMailbox()
