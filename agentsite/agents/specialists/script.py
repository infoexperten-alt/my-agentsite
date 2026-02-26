"""Script specialist agent factory."""

from __future__ import annotations

from prompture import AsyncAgent as Agent

from ..personas import SCRIPT_PERSONA
from ..tools import script_tools


def create_script_agent(model: str) -> Agent:
    """Create the Script specialist that writes JavaScript files only."""
    return Agent(
        model,
        system_prompt=SCRIPT_PERSONA,
        tools=script_tools,
        name="script",
        description="Writes JavaScript files",
        output_key="script_output",
        options={"max_tokens": 16384, "timeout": 600},
    )
