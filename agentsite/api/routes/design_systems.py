"""Design systems catalog (Phase 9)."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ...design_systems import discover_design_systems, find_design_system, summary

router = APIRouter(tags=["design-systems"])


class CreateDesignSystem(BaseModel):
    id: str
    name: str
    tokens_css: str
    description: str = ""


# In-process store for user-saved systems (file-backed when needed). For now
# this lives only in memory; Phase 9.1 will persist to the SQLite repo.
_user_systems: dict[str, dict] = {}


@router.get("/api/design-systems")
async def list_systems() -> list[dict]:
    bundled = [summary(s) for s in discover_design_systems()]
    user = [summary(s) for s in _user_systems.values()]
    return bundled + user


@router.get("/api/design-systems/{system_id}")
async def get_system(system_id: str) -> dict:
    s = find_design_system(system_id) or _user_systems.get(system_id)
    if s is None:
        raise HTTPException(status_code=404, detail="Design system not found")
    return {
        "id": s["id"],
        "name": s["name"],
        "description": s["description"],
        "tokens": s["tokens"],
        "raw_css": s["raw_css"],
        "source": s.get("source", "bundled"),
    }


@router.post("/api/design-systems")
async def save_system(req: CreateDesignSystem) -> dict:
    """Persist a user-supplied design system (in-process for now)."""
    from ...design_systems import _parse_tokens_css

    if not req.id or not req.name or not req.tokens_css:
        raise HTTPException(status_code=400, detail="id, name, tokens_css required")
    entry = {
        "id": req.id,
        "name": req.name,
        "description": req.description or req.name,
        "tokens": _parse_tokens_css(req.tokens_css),
        "raw_css": req.tokens_css,
        "source": "user",
    }
    _user_systems[req.id] = entry
    return summary(entry)
