"""Domain models for AgentSite.

All structured output types used by the agent pipeline, plus the
Project model for persistence.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from enum import Enum

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


class ReviewFeedback(BaseModel):
    """Output of the Reviewer Agent — QA feedback."""

    issues: list[str] = Field(default_factory=list, description="Issues found in the code")
    suggestions: list[str] = Field(default_factory=list, description="Improvement suggestions")
    score: int = Field(default=5, description="Quality score from 1-10")
    approved: bool = Field(default=False, description="True if score >= 7 and no critical issues")


# ------------------------------------------------------------------
# Project model (persistence)
# ------------------------------------------------------------------


class ProjectStatus(str, Enum):
    """Lifecycle status of a project."""

    created = "created"
    generating = "generating"
    completed = "completed"
    failed = "failed"


class Project(BaseModel):
    """Persistent project record."""

    id: str = Field(default_factory=lambda: uuid.uuid4().hex[:12])
    name: str = Field(default="Untitled Project")
    prompt: str = Field(default="")
    model: str = Field(default="")
    status: ProjectStatus = Field(default=ProjectStatus.created)
    site_plan: SitePlan | None = Field(default=None)
    style_spec: StyleSpec | None = Field(default=None)
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    usage: dict = Field(default_factory=dict)


# ------------------------------------------------------------------
# WebSocket event model
# ------------------------------------------------------------------


class WSEvent(BaseModel):
    """WebSocket event sent to the frontend."""

    type: str = Field(description="Event type: phase_start, phase_complete, agent_start, agent_complete, error, file_written, generation_complete")
    agent: str = Field(default="", description="Agent name")
    data: dict = Field(default_factory=dict, description="Event payload")
