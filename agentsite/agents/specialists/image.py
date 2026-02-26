"""Image specialist agent factory."""

from __future__ import annotations

from prompture import AsyncAgent as Agent

from ..personas import IMAGE_PERSONA
from ..tools import image_tools


def create_image_agent(model: str) -> Agent:
    """Create the Image specialist that generates and manages visual assets."""
    return Agent(
        model,
        system_prompt=IMAGE_PERSONA,
        tools=image_tools,
        name="image",
        description="Generates images and manages asset library",
        output_key="image_output",
        options={"max_tokens": 4096, "timeout": 300},
    )
