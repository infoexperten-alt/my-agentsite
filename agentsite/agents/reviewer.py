"""Reviewer agent factory."""

from __future__ import annotations

import json

from prompture import AsyncAgent as Agent

from ..engine.capabilities import supports_structured_output, supports_tools
from ..models import ReviewFeedback
from .personas import REVIEWER_PERSONA
from .tools import list_files, read_file


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
    else:
        return create_reviewer_agent_plain(model)


def create_reviewer_agent(model: str) -> Agent:
    """Create the Reviewer agent that QA-checks generated code."""
    return Agent(
        model,
        system_prompt=REVIEWER_PERSONA,
        output_type=ReviewFeedback,
        tools=[read_file, list_files],
        name="reviewer",
        description="Reviews generated code for quality and accessibility",
        output_key="review_feedback",
        options={"max_tokens": 4096},
    )


def create_reviewer_agent_tools_only(model: str) -> Agent:
    """Create a Reviewer agent with tools but WITHOUT structured output.

    For models that support function calling but not JSON schema enforcement.
    """
    json_schema = ReviewFeedback.model_json_schema()
    return Agent(
        model,
        system_prompt=(
            REVIEWER_PERSONA.system_prompt
            + "\n\nIMPORTANT: You MUST respond with ONLY a valid JSON object matching this schema:\n"
            + f"```json\n{json.dumps(json_schema, indent=2)}\n```\n"
            "Do NOT include any text before or after the JSON. Return ONLY the JSON object."
        ),
        tools=[read_file, list_files],
        name="reviewer",
        description="Reviews generated code (tools only mode)",
        output_key="review_feedback",
        options={"max_tokens": 4096},
    )


def create_reviewer_agent_plain(model: str) -> Agent:
    """Create a Reviewer agent WITHOUT tools or structured output.

    For models that don't support function calling. The agent will be given
    the file contents directly in the prompt instead of discovering them.
    """
    json_schema = ReviewFeedback.model_json_schema()
    return Agent(
        model,
        system_prompt=(
            REVIEWER_PERSONA.system_prompt
            + "\n\nIMPORTANT: You MUST respond with ONLY a valid JSON object matching this schema:\n"
            + f"```json\n{json.dumps(json_schema, indent=2)}\n```\n"
            "Do NOT include any text before or after the JSON. Return ONLY the JSON object.\n"
            "The generated code will be provided to you directly in the prompt."
        ),
        name="reviewer",
        description="Reviews generated code (plain text mode)",
        output_key="review_feedback",
        options={"max_tokens": 4096},
    )
