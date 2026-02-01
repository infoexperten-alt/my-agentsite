"""Project Manager agent factory."""

from __future__ import annotations

from prompture import Agent

from ..models import SitePlan
from .personas import PM_PERSONA


def create_pm_agent(model: str) -> Agent:
    """Create the PM agent that produces a SitePlan."""
    return Agent(
        model,
        system_prompt=PM_PERSONA,
        output_type=SitePlan,
        name="pm",
        description="Plans website structure and pages",
        output_key="site_plan",
    )


def create_pm_agent_plain(model: str) -> Agent:
    """Create a PM agent WITHOUT output_type for models that don't support structured output.

    Uses explicit JSON instructions in the system prompt instead of schema enforcement.
    The caller is responsible for parsing the JSON output manually.
    """
    json_schema = SitePlan.model_json_schema()
    return Agent(
        model,
        system_prompt=(
            PM_PERSONA.system_prompt
            + "\n\nIMPORTANT: You MUST respond with ONLY a valid JSON object matching this schema:\n"
            + f"```json\n{__import__('json').dumps(json_schema, indent=2)}\n```\n"
            "Do NOT include any text before or after the JSON. Return ONLY the JSON object."
        ),
        name="pm",
        description="Plans website structure and pages (plain text mode)",
        output_key="site_plan",
    )
