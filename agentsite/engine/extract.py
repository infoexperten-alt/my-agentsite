"""Structured extraction utility using Prompture's extract_with_model."""

from __future__ import annotations

import logging
from typing import TypeVar

from pydantic import BaseModel

logger = logging.getLogger("agentsite.engine.extract")

T = TypeVar("T", bound=BaseModel)


async def extract_structured(
    model_cls: type[T],
    text: str,
    model: str,
    instruction: str = "Extract information from the following text:",
    max_retries: int = 2,
) -> T | None:
    """Extract structured data from text using a lightweight LLM call.

    Wraps Prompture's ``extract_with_model`` with retry logic.
    Returns the Pydantic model instance, or ``None`` on failure.
    """
    if not text or not text.strip():
        return None

    try:
        from prompture import extract_with_model
    except ImportError:
        logger.warning("extract_with_model not available in installed Prompture version")
        return None

    import asyncio

    for attempt in range(1, max_retries + 1):
        try:
            raw = await asyncio.to_thread(
                extract_with_model,
                model_cls,
                text=text,
                model_name=model,
                instruction_template=instruction,
                max_retries=1,
            )
            if isinstance(raw, dict):
                return model_cls.model_validate(raw)
            if isinstance(raw, model_cls):
                return raw
            return model_cls.model_validate(raw)
        except Exception:
            if attempt < max_retries:
                logger.debug(
                    "extract_structured attempt %d/%d failed for %s, retrying",
                    attempt, max_retries, model_cls.__name__,
                )
            else:
                logger.warning(
                    "extract_structured failed after %d attempts for %s",
                    max_retries, model_cls.__name__,
                    exc_info=True,
                )
    return None
