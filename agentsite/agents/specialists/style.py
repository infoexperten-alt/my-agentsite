"""Style specialist agent factories (CSS and SCSS)."""

from __future__ import annotations

from prompture import AsyncAgent as Agent

from ..personas import STYLE_PERSONA, STYLE_SCSS_PERSONA
from ..tools import style_tools


def create_style_agent(model: str) -> Agent:
    """Create the Style specialist that writes CSS files only."""
    return Agent(
        model,
        system_prompt=STYLE_PERSONA,
        tools=style_tools,
        name="style",
        description="Writes CSS stylesheets",
        output_key="style_output",
        options={"max_tokens": 16384, "timeout": 600},
    )


def create_style_scss_agent(model: str) -> Agent:
    """Create the SCSS Style specialist that writes SCSS files only."""
    return Agent(
        model,
        system_prompt=STYLE_SCSS_PERSONA,
        tools=style_tools,
        name="style_scss",
        description="Writes SCSS stylesheets",
        output_key="style_output",
        options={"max_tokens": 16384, "timeout": 600},
    )
