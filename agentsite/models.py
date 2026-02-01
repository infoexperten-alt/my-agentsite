"""Domain models for AgentSite.

All structured output types used by the agent pipeline, plus the
persistence models for Project, Page, and PageVersion.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from pydantic import BaseModel, Field

# ------------------------------------------------------------------
# Pipeline output models (used as Agent output_type)
# ------------------------------------------------------------------


class PagePlan(BaseModel):
    """Plan for a single page within a site."""

    slug: str = Field(description="URL slug, e.g. 'index', 'about', 'contact'")
    title: str = Field(description="Page title")
    sections: list[str] = Field(description="Ordered list of section descriptions")
    priority: int = Field(default=1, description="Build priority (1 = highest)")


class SitePlan(BaseModel):
    """Output of the PM Agent — overall site structure."""

    project_name: str = Field(description="Name of the website project")
    tagline: str = Field(description="One-line description of the site")
    pages: list[PagePlan] = Field(description="Pages to generate, ordered by priority")
    shared_components: list[str] = Field(
        default_factory=lambda: ["navbar", "footer"],
        description="Shared UI components across pages",
    )
    required_agents: list[str] = Field(
        default_factory=lambda: ["designer", "developer", "reviewer"],
        description=(
            "Which agents are needed for this task. Subset of "
            "['designer', 'developer', 'reviewer']. "
            "Developer is always required. Designer is needed for new sites or "
            "brand changes, not for content edits. Reviewer is needed for complex "
            "builds, not for simple text changes."
        ),
    )


class StyleSpec(BaseModel):
    """Output of the Designer Agent — visual design specification."""

    primary_color: str = Field(default="#2563eb", description="Primary brand color (hex)")
    secondary_color: str = Field(default="#1e40af", description="Secondary color (hex)")
    accent_color: str = Field(default="#f59e0b", description="Accent color (hex)")
    background_color: str = Field(default="#ffffff", description="Page background (hex)")
    text_color: str = Field(default="#1f2937", description="Body text color (hex)")
    font_heading: str = Field(default="Inter", description="Heading font family (Google Fonts)")
    font_body: str = Field(default="Inter", description="Body font family (Google Fonts)")
    border_radius: str = Field(default="8px", description="Default border radius")
    spacing_unit: str = Field(default="1rem", description="Base spacing unit")


class GeneratedFile(BaseModel):
    """A single file produced by the Developer Agent."""

    path: str = Field(description="Relative file path, e.g. 'index.html'")
    content: str = Field(description="Full file content")
    language: str = Field(default="html", description="File language: html, css, js")


class PageOutput(BaseModel):
    """Output of the Developer Agent — generated files for one page."""

    files: list[GeneratedFile] = Field(description="Generated files for this page")
    notes: str = Field(default="", description="Developer notes about the implementation")


class PageOutputSummary(BaseModel):
    """Lightweight summary returned by Developer Agent after writing files via tools.

    The actual file contents are written to disk using the write_file tool.
    This model only captures metadata so that JSON parsing stays reliable.
    """

    files_written: list[str] = Field(
        description="List of relative file paths that were written using the write_file tool, e.g. ['index.html', 'styles.css']"
    )
    notes: str = Field(default="", description="Brief developer notes about the implementation")


class ReviewFeedback(BaseModel):
    """Output of the Reviewer Agent — QA feedback."""

    issues: list[str] = Field(default_factory=list, description="Issues found in the code")
    suggestions: list[str] = Field(default_factory=list, description="Improvement suggestions")
    score: int = Field(default=5, description="Quality score from 1-10")
    approved: bool = Field(default=False, description="True if score >= 7 and no critical issues")


# ------------------------------------------------------------------
# Persistence models
# ------------------------------------------------------------------


class Project(BaseModel):
    """Persistent project record — top-level container with branding."""

    id: str = Field(default_factory=lambda: uuid.uuid4().hex[:12])
    name: str = Field(default="Untitled Project")
    description: str = Field(default="")
    model: str = Field(default="")
    logo_url: str = Field(default="")
    icon_url: str = Field(default="")
    style_spec: StyleSpec | None = Field(default=None)
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class Page(BaseModel):
    """A page within a project."""

    id: str = Field(default_factory=lambda: uuid.uuid4().hex[:12])
    project_id: str = Field(default="")
    slug: str = Field(default="home")
    title: str = Field(default="Home Page")
    prompt: str = Field(default="")
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class PageVersion(BaseModel):
    """A versioned output for a page."""

    id: str = Field(default_factory=lambda: uuid.uuid4().hex[:12])
    page_id: str = Field(default="")
    version_number: int = Field(default=1)
    status: str = Field(default="generating")  # generating, completed, failed
    prompt: str = Field(default="")
    usage: dict = Field(default_factory=dict)
    files: dict = Field(default_factory=dict)
    error: str | None = Field(default=None)
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    completed_at: str | None = Field(default=None)


# ------------------------------------------------------------------
# Agent configuration & run tracking
# ------------------------------------------------------------------


class AgentConfig(BaseModel):
    """Server-side configuration for a pipeline agent."""

    agent_name: str = Field(description="Agent key: pm, designer, developer, reviewer")
    enabled: bool = Field(default=True, description="Whether this agent is active")
    model: str = Field(default="", description="Model override (empty = use project default)")
    temperature: float = Field(default=0.5, description="Sampling temperature 0-1")
    system_prompt_override: str | None = Field(
        default=None, description="Custom system prompt (None = use default persona)"
    )
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class AgentRun(BaseModel):
    """Record of a single agent execution during generation."""

    id: str = Field(default_factory=lambda: uuid.uuid4().hex[:12])
    project_id: str = Field(default="")
    page_slug: str = Field(default="")
    version: int = Field(default=1)
    agent_name: str = Field(default="")
    status: str = Field(default="running")  # running, completed, skipped, failed
    started_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    completed_at: str | None = Field(default=None)
    input_tokens: int = Field(default=0)
    output_tokens: int = Field(default=0)
    cost: float = Field(default=0.0)
    output_summary: dict = Field(default_factory=dict)


# ------------------------------------------------------------------
# WebSocket event model
# ------------------------------------------------------------------


class ChatMessage(BaseModel):
    """A chat message within a page builder session."""

    id: str = Field(default_factory=lambda: uuid.uuid4().hex[:12])
    page_id: str = Field(default="")
    role: str = Field(default="user")  # user, agent, agent-progress
    content: str = Field(default="")
    image: str | None = Field(default=None)
    meta: dict = Field(default_factory=dict)  # agents list, done flag, etc.
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


# ------------------------------------------------------------------
# WebSocket event model
# ------------------------------------------------------------------


class WSEvent(BaseModel):
    """WebSocket event sent to the frontend."""

    type: str = Field(description="Event type: phase_start, phase_complete, agent_start, agent_complete, error, file_written, generation_complete")
    agent: str = Field(default="", description="Agent name")
    data: dict = Field(default_factory=dict, description="Event payload")
