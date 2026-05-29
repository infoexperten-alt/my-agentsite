"""Design directions catalog."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ...agents.directions import direction_summary, find_direction, list_direction_summaries

router = APIRouter(tags=["directions"])


@router.get("/api/directions")
async def list_directions() -> list[dict]:
    """Return the catalog of design directions for the picker UI."""
    return list_direction_summaries()


@router.get("/api/directions/{direction_id}")
async def get_direction(direction_id: str) -> dict:
    d = find_direction(direction_id)
    if d is None:
        raise HTTPException(status_code=404, detail="Direction not found")
    return direction_summary(d)
