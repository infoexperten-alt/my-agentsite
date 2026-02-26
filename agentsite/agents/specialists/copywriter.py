"""Copywriter specialist agent factory."""

from __future__ import annotations

from prompture import AsyncAgent as Agent

from ..personas import COPYWRITER_PERSONA
from ..tools import copywriter_tools


def create_copywriter_agent(model: str) -> Agent:
    """Create the Copywriter specialist that rewrites placeholder text."""
    return Agent(
        model,
        system_prompt=COPYWRITER_PERSONA,
        tools=copywriter_tools,
        name="copywriter",
        description="Rewrites placeholder text with compelling copy",
        output_key="copywriter_output",
        options={"max_tokens": 16384, "timeout": 600},
    )
