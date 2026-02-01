"""Reviewer agent factory."""

from __future__ import annotations

from prompture import Agent

from ..models import ReviewFeedback
from .personas import REVIEWER_PERSONA
from .tools import list_files, read_file


def create_reviewer_agent(model: str) -> Agent:
    """Create the Reviewer agent that QA-checks generated code."""
    return Agent(
        model,
        system_prompt=REVIEWER_PERSONA,
        output_type=ReviewFeedback,
        tools=[read_file, list_files],
        name="reviewer",
        description="Reviews generated code for quality and accessibility",
        output_key="review_feedback",
    )
