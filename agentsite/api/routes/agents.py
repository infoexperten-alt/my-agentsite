"""Agent configuration and run history endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ...models import AgentConfig
from ..deps import get_agent_config_repo, get_agent_run_repo

router = APIRouter(prefix="/api/agents", tags=["agents"])


class UpdateAgentRequest(BaseModel):
    enabled: bool | None = None
    model: str | None = None
    temperature: float | None = None
    system_prompt_override: str | None = None


@router.get("", response_model=list[AgentConfig])
async def list_agents(repo=Depends(get_agent_config_repo)):
    """List all agent configurations."""
    return await repo.list_all()


@router.put("/{agent_name}", response_model=AgentConfig)
async def update_agent(
    agent_name: str,
    req: UpdateAgentRequest,
    repo=Depends(get_agent_config_repo),
):
    """Update an agent's configuration."""
    config = await repo.get(agent_name)
    if config is None:
        raise HTTPException(status_code=404, detail=f"Agent '{agent_name}' not found")

    if req.enabled is not None:
        config.enabled = req.enabled
    if req.model is not None:
        config.model = req.model
    if req.temperature is not None:
        config.temperature = max(0.0, min(1.0, req.temperature))
    if req.system_prompt_override is not None:
        config.system_prompt_override = req.system_prompt_override or None

    await repo.update(config)
    return config


@router.get("/runs")
async def list_agent_runs(limit: int = 50, repo=Depends(get_agent_run_repo)):
    """List recent agent runs."""
    runs = await repo.list_recent(limit)
    return [r.model_dump() for r in runs]


@router.get("/stats")
async def get_agent_stats(repo=Depends(get_agent_run_repo)):
    """Get aggregated agent statistics."""
    return await repo.get_stats()
