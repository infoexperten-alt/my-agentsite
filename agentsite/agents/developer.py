"""Developer agent factory."""

from __future__ import annotations

from prompture import Agent

from ..models import PageOutputSummary
from .personas import DEVELOPER_PERSONA
from .tools import list_files, read_file, write_file


def create_developer_agent(model: str) -> Agent:
    """Create the Developer agent that generates page files."""
    return Agent(
        model,
        system_prompt=DEVELOPER_PERSONA,
        output_type=PageOutputSummary,
        tools=[write_file, read_file, list_files],
        name="developer",
        description="Generates HTML/CSS/JS files for each page",
        output_key="page_output",
    )
