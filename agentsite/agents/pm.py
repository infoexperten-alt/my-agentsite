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
