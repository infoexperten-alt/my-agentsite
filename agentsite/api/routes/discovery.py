"""Discovery form schema endpoint."""

from __future__ import annotations

from fastapi import APIRouter

from ...agents.discovery import DISCOVERY_FORM_SCHEMA

router = APIRouter(tags=["discovery"])


@router.get("/api/discovery/form")
async def get_discovery_form() -> dict:
    """Return the discovery form schema for the frontend to render.

    The shape mirrors open-design's `<question-form id="discovery">` and is
    consumed by `frontend/src/components/builder/DiscoveryForm.jsx`.
    """
    return DISCOVERY_FORM_SCHEMA
