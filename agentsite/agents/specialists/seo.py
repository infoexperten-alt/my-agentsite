"""SEO specialist agent factory."""

from __future__ import annotations

from prompture import AsyncAgent as Agent

from ..personas import SEO_PERSONA
from ..tools import seo_tools


def create_seo_agent(model: str) -> Agent:
    """Create the SEO specialist that optimizes pages for search engines."""
    return Agent(
        model,
        system_prompt=SEO_PERSONA,
        tools=seo_tools,
        name="seo",
        description="Injects meta tags, structured data, sitemap",
        output_key="seo_output",
        options={"max_tokens": 8192, "timeout": 600},
    )
