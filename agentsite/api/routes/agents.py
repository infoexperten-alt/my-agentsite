"""Agent configuration and run history endpoints."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ...models import AgentConfig
from ..deps import get_agent_config_repo, get_agent_run_repo

logger = logging.getLogger("agentsite.api.agents")

router = APIRouter(prefix="/api/agents", tags=["agents"])


class UpdateAgentRequest(BaseModel):
    enabled: bool | None = None
    model: str | None = None
    temperature: float | None = None
    system_prompt_override: str | None = None


@router.get("/catalog")
async def get_catalog():
    """Return the full agent catalog with metadata for all registered agents."""
    from agentsite.agents.registry import AgentRegistry

    return AgentRegistry.to_catalog()


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
async def list_agent_runs(
    limit: int = 50,
    since: str | None = None,
    repo=Depends(get_agent_run_repo),
):
    """List recent agent runs."""
    runs = await repo.list_recent(limit, since=since)
    return [r.model_dump() for r in runs]


@router.get("/stats")
async def get_agent_stats(
    since: str | None = None,
    repo=Depends(get_agent_run_repo),
):
    """Get aggregated agent statistics, enriched with tracker data when available."""
    stats = await repo.get_stats(since=since)
    # Enrich with Prompture ledger data (additive fields)
    try:
        from prompture.infra.ledger import ModelUsageLedger

        ledger = ModelUsageLedger()
        all_stats = ledger.get_all_stats()
        cost_by_model = {
            s["model_name"]: round(s["total_cost"], 4)
            for s in all_stats
            if s.get("model_name") and s.get("total_cost", 0) > 0
        }
        stats["cost_by_model"] = cost_by_model

        # Compute cost_today and cost_this_month from agent_runs table
        from datetime import datetime, timezone

        now = datetime.now(timezone.utc)
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()

        today_stats = await repo.get_stats(since=today_start)
        month_stats = await repo.get_stats(since=month_start)
        stats["cost_today"] = today_stats.get("total_cost", 0.0)
        stats["cost_this_month"] = month_stats.get("total_cost", 0.0)
    except Exception:
        pass
    return stats


@router.get("/stats/daily")
async def get_daily_stats(
    days: int = 30,
    repo=Depends(get_agent_run_repo),
):
    """Get daily token aggregates for the last N days."""
    return await repo.get_daily_stats(days=days)


@router.get("/stats/models")
async def get_model_stats():
    """Get cost breakdown by model from Prompture's ModelUsageLedger."""
    try:
        from prompture.infra.ledger import ModelUsageLedger

        ledger = ModelUsageLedger()
        all_stats = ledger.get_all_stats()
        cost_by_model = {
            s["model_name"]: {
                "total_cost": round(s["total_cost"], 4),
                "use_count": s["use_count"],
                "total_tokens": s["total_tokens"],
            }
            for s in all_stats
            if s.get("model_name")
        }
        return {"cost_by_model": cost_by_model}
    except ImportError:
        return {"cost_by_model": {}}
    except Exception as exc:
        logger.warning("Failed to get model stats from ledger: %s", exc)
        return {"cost_by_model": {}}


@router.get("/stats/providers")
async def get_provider_stats():
    """Get cost breakdown by provider from Prompture's ModelUsageLedger."""
    try:
        from prompture.infra.ledger import ModelUsageLedger

        ledger = ModelUsageLedger()
        all_stats = ledger.get_all_stats()
        # Group by provider prefix (e.g. "openai/gpt-4o" -> "openai")
        cost_by_provider: dict[str, float] = {}
        for s in all_stats:
            model_name = s.get("model_name", "")
            provider = model_name.split("/")[0] if "/" in model_name else model_name
            if provider:
                cost_by_provider[provider] = round(
                    cost_by_provider.get(provider, 0.0) + (s.get("total_cost", 0.0)),
                    4,
                )
        return {"cost_by_provider": cost_by_provider}
    except ImportError:
        return {"cost_by_provider": {}}
    except Exception as exc:
        logger.warning("Failed to get provider stats from ledger: %s", exc)
        return {"cost_by_provider": {}}


@router.get("/stats/today")
async def get_today_stats(repo=Depends(get_agent_run_repo)):
    """Get today and this month cost totals from agent runs."""
    try:
        from datetime import datetime, timezone

        now = datetime.now(timezone.utc)
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()

        today_stats = await repo.get_stats(since=today_start)
        month_stats = await repo.get_stats(since=month_start)
        return {
            "cost_today": today_stats.get("total_cost", 0.0),
            "cost_this_month": month_stats.get("total_cost", 0.0),
        }
    except Exception as exc:
        logger.warning("Failed to get today stats: %s", exc)
        return {"cost_today": 0.0, "cost_this_month": 0.0}


@router.get("/stats/session/{session_id}")
async def get_session_stats(session_id: str, repo=Depends(get_agent_run_repo)):
    """Get usage summary for a specific generation session from agent runs."""
    runs = await repo.list_recent(limit=100)
    session_runs = [r for r in runs if r.session_id == session_id]
    if not session_runs:
        raise HTTPException(status_code=404, detail=f"No runs found for session '{session_id}'")

    total_input = sum(r.input_tokens for r in session_runs)
    total_output = sum(r.output_tokens for r in session_runs)
    total_cost = sum(r.cost for r in session_runs)
    return {
        "session_id": session_id,
        "total_tokens": total_input + total_output,
        "input_tokens": total_input,
        "output_tokens": total_output,
        "total_cost": round(total_cost, 4),
        "agents": [r.agent_name for r in session_runs],
    }


@router.post("/runs/backfill-costs")
async def backfill_costs(repo=Depends(get_agent_run_repo)):
    """Recalculate costs for existing runs that have tokens but zero cost.

    Uses Prompture's pricing engine to compute costs from stored token counts
    and the project's model.
    """
    updated = await repo.backfill_costs()
    return {"updated": updated}
