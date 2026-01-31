"""WebSocket manager bridging Prompture callbacks to connected clients."""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

from fastapi import WebSocket

from ..models import WSEvent

logger = logging.getLogger("agentsite.websocket")


class WebSocketManager:
    """Manages WebSocket connections per project and broadcasts events."""

    def __init__(self) -> None:
        self._connections: dict[str, list[WebSocket]] = {}

    async def connect(self, project_id: str, ws: WebSocket) -> None:
        """Accept and register a WebSocket connection for a project."""
        await ws.accept()
        self._connections.setdefault(project_id, []).append(ws)
        logger.debug("WebSocket connected for project %s", project_id)

    def disconnect(self, project_id: str, ws: WebSocket) -> None:
        """Remove a WebSocket connection."""
        conns = self._connections.get(project_id, [])
        if ws in conns:
            conns.remove(ws)
        if not conns:
            self._connections.pop(project_id, None)

    async def broadcast(self, project_id: str, event: WSEvent) -> None:
        """Send an event to all connected clients for a project."""
        conns = self._connections.get(project_id, [])
        dead: list[WebSocket] = []

        payload = event.model_dump_json()

        for ws in conns:
            try:
                await ws.send_text(payload)
            except Exception:
                dead.append(ws)

        for ws in dead:
            self.disconnect(project_id, ws)

    def make_callback(self, project_id: str, loop: asyncio.AbstractEventLoop):
        """Create a sync callback that bridges to async broadcast.

        Returns a callable suitable for GenerationPipeline.on_event.
        """

        def _on_event(event: WSEvent) -> None:
            asyncio.run_coroutine_threadsafe(
                self.broadcast(project_id, event), loop
            )

        return _on_event


ws_manager = WebSocketManager()
