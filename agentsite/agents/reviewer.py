"""Reviewer agent factory built on top of prompture.Assistant."""

from __future__ import annotations

import json

from prompture import Assistant, AsyncAgent as Agent

from ..engine.capabilities import supports_structured_output, supports_tools
from ..models import ReviewFeedback
from .personas import REVIEWER_PERSONA
from .tools import reviewer_tools

_REV_OPTIONS = {"max_tokens": 4096}


def _json_only_persona():
    """Persona that demands a JSON-only response matching ReviewFeedback's schema."""
    schema = ReviewFeedback.model_json_schema()
    return REVIEWER_PERSONA.extend(
        "IMPORTANT: You MUST respond with ONLY a valid JSON object matching this schema:\n"
        f"```json\n{json.dumps(schema, indent=2)}\n```\n"
        "Do NOT include any text before or after the JSON. Return ONLY the JSON object."
    )


def _json_only_plain_persona():
    """Same as :func:`_json_only_persona` but for the no-tools variant."""
    return _json_only_persona().extend(
        "The generated code will be provided to you directly in the prompt."
    )


def create_reviewer_agent_auto(model: str) -> Agent:
    """Create the Reviewer agent, automatically selecting the best mode.

    Uses capability detection to choose between:
    - Full mode (tools + structured output)
    - Tools-only mode (tools, no structured output)
    - Plain mode (no tools, no structured output)
    """
    has_tools = supports_tools(model)
    has_structured = supports_structured_output(model)

    if has_tools and has_structured:
        return create_reviewer_agent(model)
    elif has_tools:
        return create_reviewer_agent_tools_only(model)
    return create_reviewer_agent_plain(model)


def create_reviewer_agent(model: str) -> Agent:
    """Reviewer with tools + Pydantic structured output."""
    return Assistant(
        name="reviewer",
        description="Reviews generated code for quality and accessibility",
        persona=REVIEWER_PERSONA,
        tools=reviewer_tools,
        model=model,
        output_type=ReviewFeedback,
        output_key="review_feedback",
        options=_REV_OPTIONS,
    ).build_async_agent()


def create_reviewer_agent_tools_only(model: str) -> Agent:
    """Reviewer with tools but no Pydantic structured output (JSON via prompt)."""
    return Assistant(
        name="reviewer",
        description="Reviews generated code (tools only mode)",
        persona=_json_only_persona(),
        tools=reviewer_tools,
        model=model,
        output_key="review_feedback",
        options=_REV_OPTIONS,
    ).build_async_agent()


def create_reviewer_agent_plain(model: str) -> Agent:
    """Reviewer with neither tools nor structured output (JSON via prompt)."""
    return Assistant(
        name="reviewer",
        description="Reviews generated code (plain text mode)",
        persona=_json_only_plain_persona(),
        model=model,
        output_key="review_feedback",
        options=_REV_OPTIONS,
    ).build_async_agent()
