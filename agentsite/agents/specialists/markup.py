"""Markup specialist agent factory."""

from __future__ import annotations

from prompture import AsyncAgent as Agent

from ..personas import MARKUP_PERSONA
from ..tools import markup_tools


def create_markup_agent(model: str) -> Agent:
    """Create the Markup specialist that writes HTML/JSX files only."""
    return Agent(
        model,
        system_prompt=MARKUP_PERSONA,
        tools=markup_tools,
        name="markup",
        description="Writes HTML/JSX markup files",
        output_key="markup_output",
        options={"max_tokens": 32768, "timeout": 600},
    )
