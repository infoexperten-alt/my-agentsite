"""Model discovery endpoint."""

from __future__ import annotations

import logging

from fastapi import APIRouter

logger = logging.getLogger("agentsite.api.models")
router = APIRouter(prefix="/api/models", tags=["models"])


@router.get("")
async def list_models():
    """Auto-detect available models from configured providers."""
    try:
        from prompture import get_available_models

        models = get_available_models()
    except Exception as exc:
        logger.warning("Model discovery failed: %s", exc)
        models = []

    return {"models": models}
