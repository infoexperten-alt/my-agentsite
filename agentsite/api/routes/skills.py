"""Skills catalog endpoint (Phase 5)."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ...skills import discover_bundled_skills, find_skill, skill_summary

router = APIRouter(tags=["skills"])


@router.get("/api/skills")
async def list_skills() -> list[dict]:
    return [skill_summary(s) for s in discover_bundled_skills()]


@router.get("/api/skills/{name}")
async def get_skill_detail(name: str) -> dict:
    skill = find_skill(name)
    if skill is None:
        raise HTTPException(status_code=404, detail="Skill not found")
    body = skill_summary(skill)
    # Include the full instructions when requested individually
    body["instructions"] = skill.instructions
    return body
