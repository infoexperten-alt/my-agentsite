"""Animation specialist agent factory."""

from __future__ import annotations

from prompture import AsyncAgent as Agent

from ..personas import ANIMATION_PERSONA
from ..tools import animation_tools


def create_animation_agent(model: str) -> Agent:
    """Create the Animation specialist that adds scroll-triggered animations."""
    return Agent(
        model,
        system_prompt=ANIMATION_PERSONA,
        tools=animation_tools,
        name="animation",
        description="Creates scroll-triggered animations and transitions",
        output_key="animation_output",
        options={"max_tokens": 16384, "timeout": 600},
    )
