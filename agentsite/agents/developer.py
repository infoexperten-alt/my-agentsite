"""Developer agent factory."""

from __future__ import annotations

from prompture import Agent

from .personas import DEVELOPER_PERSONA
from .tools import list_files, read_file, write_file


def create_developer_agent(model: str) -> Agent:
    """Create the Developer agent that generates page files.

    Note: No ``output_type`` is set because the developer writes files
    via the ``write_file`` tool.  Forcing structured-output parsing on the
    final text response causes failures when the LLM returns empty text
    after finishing its tool calls.  The pipeline already handles file
    extraction from both tool-written files and raw output text.
    """
    return Agent(
        model,
        system_prompt=DEVELOPER_PERSONA,
        tools=[write_file, read_file, list_files],
        name="developer",
        description="Generates HTML/CSS/JS files for each page",
        output_key="page_output",
    )
