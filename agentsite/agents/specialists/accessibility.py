"""Accessibility specialist agent factory."""

from __future__ import annotations

from prompture import AsyncAgent as Agent

from ..personas import ACCESSIBILITY_PERSONA
from ..tools import accessibility_tools


def create_accessibility_agent(model: str) -> Agent:
    """Create the Accessibility specialist that ensures WCAG AA compliance."""
    return Agent(
        model,
        system_prompt=ACCESSIBILITY_PERSONA,
        tools=accessibility_tools,
        name="accessibility",
        description="Adds ARIA labels, fixes contrast, ensures WCAG AA",
        output_key="accessibility_output",
        options={"max_tokens": 16384, "timeout": 600},
    )
