"""Designer agent factory."""

from __future__ import annotations

from prompture import Agent

from ..models import StyleSpec
from .personas import DESIGNER_PERSONA


def create_designer_agent(model: str) -> Agent:
    """Create the Designer agent that produces a StyleSpec."""
    return Agent(
        model,
        system_prompt=DESIGNER_PERSONA,
        output_type=StyleSpec,
        name="designer",
        description="Defines visual design system (colors, fonts, spacing)",
        output_key="style_spec",
    )
