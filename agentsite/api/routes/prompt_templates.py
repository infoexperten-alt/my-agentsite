"""Prompt template gallery (Phase 12)."""

from __future__ import annotations

from fastapi import APIRouter

from ...prompt_templates import discover_templates

router = APIRouter(tags=["prompt-templates"])


@router.get("/api/prompt-templates")
async def list_prompt_templates() -> list[dict]:
    return discover_templates()
