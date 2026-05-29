"""Design systems catalog (Phase 9 + Phase 13 SQLite persistence)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ...design_systems import (
    _parse_tokens_css,
    discover_design_systems,
    find_design_system,
    summary,
)
from ..deps import get_design_system_repo

router = APIRouter(tags=["design-systems"])


class CreateDesignSystem(BaseModel):
    id: str
    name: str
    tokens_css: str
    description: str = ""


def _user_to_full(row: dict) -> dict:
    """Repository row → catalog-shape dict matching the bundled loader."""
    tokens = _parse_tokens_css(row["tokens_css"] or "")
    return {
        "id": row["id"],
        "name": row["name"],
        "description": row["description"],
        "tokens": tokens,
        "raw_css": row["tokens_css"],
        "source": row.get("source", "user"),
    }


@router.get("/api/design-systems")
async def list_systems(repo=Depends(get_design_system_repo)) -> list[dict]:
    bundled = [summary(s) for s in discover_design_systems()]
    user_rows = await repo.list_all()
    return bundled + [summary(_user_to_full(r)) for r in user_rows]


@router.get("/api/design-systems/{system_id}")
async def get_system(system_id: str, repo=Depends(get_design_system_repo)) -> dict:
    bundled = find_design_system(system_id)
    if bundled is not None:
        s = bundled
    else:
        row = await repo.get(system_id)
        if row is None:
            raise HTTPException(status_code=404, detail="Design system not found")
        s = _user_to_full(row)
    return {
        "id": s["id"],
        "name": s["name"],
        "description": s["description"],
        "tokens": s["tokens"],
        "raw_css": s["raw_css"],
        "source": s.get("source", "bundled"),
    }


@router.post("/api/design-systems")
async def save_system(req: CreateDesignSystem, repo=Depends(get_design_system_repo)) -> dict:
    """Persist a user-supplied design system to SQLite."""
    if not req.id or not req.name or not req.tokens_css:
        raise HTTPException(status_code=400, detail="id, name, tokens_css required")
    # Reject collisions with bundled ids
    if find_design_system(req.id) is not None:
        raise HTTPException(status_code=409, detail="id collides with a bundled system")
    row = await repo.create(
        id=req.id,
        name=req.name,
        description=req.description or req.name,
        tokens_css=req.tokens_css,
        source="user",
    )
    return summary(_user_to_full(row))


@router.delete("/api/design-systems/{system_id}")
async def delete_system(system_id: str, repo=Depends(get_design_system_repo)) -> dict:
    if find_design_system(system_id) is not None:
        raise HTTPException(status_code=400, detail="Cannot delete bundled systems")
    ok = await repo.delete(system_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Design system not found")
    return {"deleted": system_id}
