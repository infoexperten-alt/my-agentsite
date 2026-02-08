"""Designer agent factory."""

from __future__ import annotations

from prompture import AsyncAgent as Agent

from ..engine.capabilities import supports_structured_output
from ..models import StyleSpec
from .personas import DESIGNER_PERSONA


def create_designer_agent_auto(model: str) -> Agent:
    """Create the Designer agent, automatically selecting structured or plain mode.

    Uses capability detection to choose the right variant upfront,
    avoiding runtime fallbacks.
    """
    if supports_structured_output(model):
        return create_designer_agent(model)
    return create_designer_agent_plain(model)


def create_designer_agent(model: str) -> Agent:
    """Create the Designer agent that produces a StyleSpec."""
    return Agent(
        model,
        system_prompt=DESIGNER_PERSONA,
        output_type=StyleSpec,
        name="designer",
        description="Defines visual design system (colors, fonts, spacing)",
        output_key="style_spec",
        options={"max_tokens": 4096},
    )


def create_designer_agent_plain(model: str) -> Agent:
    """Create a Designer agent WITHOUT output_type for models that don't support structured output.

    Uses explicit JSON instructions in the system prompt instead of schema enforcement.
    The caller is responsible for parsing the JSON output manually.
    """
    json_schema = StyleSpec.model_json_schema()
    return Agent(
        model,
        system_prompt=(
            DESIGNER_PERSONA.system_prompt
            + "\n\nIMPORTANT: You MUST respond with ONLY a valid JSON object matching this schema:\n"
            + f"```json\n{__import__('json').dumps(json_schema, indent=2)}\n```\n"
            "Do NOT include any text before or after the JSON. Return ONLY the JSON object."
        ),
        name="designer",
        description="Defines visual design system (plain text mode)",
        output_key="style_spec",
        options={"max_tokens": 4096},
    )
