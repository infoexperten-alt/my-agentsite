"""Project Manager agent factory."""

from __future__ import annotations

import json

from prompture import AsyncAgent as Agent

from ..engine.capabilities import supports_structured_output
from ..models import SitePlan
from .personas import PM_PERSONA


def create_pm_agent_auto(model: str) -> Agent:
    """Create the PM agent, automatically selecting structured or plain mode.

    Uses capability detection to choose the right variant upfront,
    avoiding runtime fallbacks.
    """
    if supports_structured_output(model):
        return create_pm_agent(model)
    return create_pm_agent_plain(model)


def create_pm_agent(model: str) -> Agent:
    """Create the PM agent that produces a SitePlan."""
    return Agent(
        model,
        system_prompt=PM_PERSONA,
        output_type=SitePlan,
        name="pm",
        description="Plans website structure and pages",
        output_key="site_plan",
        options={"max_tokens": 4096},
    )


def create_pm_agent_plain(model: str) -> Agent:
    """Create a PM agent WITHOUT output_type for models that don't support structured output.

    Uses explicit JSON instructions in the system prompt instead of schema enforcement.
    The caller is responsible for parsing the JSON output manually.
    """
    json_schema = SitePlan.model_json_schema()
    return Agent(
        model,
        system_prompt=PM_PERSONA.extend(
            "IMPORTANT: You MUST respond with ONLY a valid JSON object matching this schema:\n"
            f"```json\n{json.dumps(json_schema, indent=2)}\n```\n"
            "Do NOT include any text before or after the JSON. Return ONLY the JSON object."
        ),
        name="pm",
        description="Plans website structure and pages (plain text mode)",
        output_key="site_plan",
        options={"max_tokens": 4096},
    )
