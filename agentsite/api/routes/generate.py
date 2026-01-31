"""Generation endpoints — POST trigger + WebSocket progress."""

from __future__ import annotations

import asyncio
import logging
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

from ...engine.pipeline import GenerationPipeline
from ...models import ProjectStatus
from ..deps import get_pm, get_repo
from ..websocket import ws_manager

logger = logging.getLogger("agentsite.api.generate")
router = APIRouter(tags=["generate"])

# Thread pool for running sync Prompture pipelines
_executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="agentsite-gen")


class GenerateRequest(BaseModel):
    prompt: str = ""
    model: str = ""


@router.post("/api/projects/{project_id}/generate")
async def start_generation(
    project_id: str,
    req: GenerateRequest,
    repo=Depends(get_repo),
    pm=Depends(get_pm),
):
    """Start site generation for a project."""
    project = await repo.get(project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    if project.status == ProjectStatus.generating:
        raise HTTPException(status_code=409, detail="Generation already in progress")

    # Update prompt/model if provided
    if req.prompt:
        project.prompt = req.prompt
    if req.model:
        project.model = req.model

    if not project.prompt:
        raise HTTPException(status_code=400, detail="Prompt is required")

    project.status = ProjectStatus.generating
    await repo.update(project)

    # Get event loop for WS bridge
    loop = asyncio.get_running_loop()
    on_event = ws_manager.make_callback(project_id, loop)

    # Build pipeline
    pipeline = GenerationPipeline(pm, on_event=on_event)

    # Record generation start
    started_at = datetime.now(timezone.utc).isoformat()
    gen_id = await repo.record_generation(project_id, started_at)

    # Run in thread pool (Prompture groups are synchronous)
    async def _run():
        try:
            result = await loop.run_in_executor(_executor, pipeline.generate, project)
            # Update generation record
            await repo.update_generation(
                gen_id,
                completed_at=datetime.now(timezone.utc).isoformat(),
                status="completed",
                usage=result.aggregate_usage,
            )
            # Refresh project from disk
            project.status = ProjectStatus.completed
            project.usage = result.aggregate_usage
            await repo.update(project)
        except Exception as exc:
            logger.exception("Generation failed")
            await repo.update_generation(
                gen_id,
                completed_at=datetime.now(timezone.utc).isoformat(),
                status="failed",
                error=str(exc),
            )
            project.status = ProjectStatus.failed
            await repo.update(project)

    # Fire and forget
    asyncio.create_task(_run())

    return {
        "project_id": project_id,
        "generation_id": gen_id,
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
