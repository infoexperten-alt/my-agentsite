"""Project component library — REST routes (Phase 4).

A project component is a user-saved BlockDefinition shape-compatible
with htmlstudio's built-in blocks. The same palette + render pipeline
handles both.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ...engine.blocks import render_block as _render_block_html
from ...engine.component_extractor import extract as _extract_component
from ...models import BlockFieldModel, ProjectComponent
from ..deps import get_page_repo, get_pm, get_project_component_repo, get_repo

logger = logging.getLogger("agentsite.api.components")
router = APIRouter(prefix="/api/projects/{project_id}/components", tags=["components"])

_SLUG_RE = re.compile(r"^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$")


def _validate_slug(slug: str) -> None:
    if not _SLUG_RE.match(slug):
        raise HTTPException(
            status_code=400,
            detail="slug must be kebab-case (lowercase letters / digits / hyphens, no leading/trailing hyphen)",
        )


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------


class CreateComponentBody(BaseModel):
    name: str = Field(..., description="Human display name (e.g. 'Pricing Card').")
    slug: str = Field(..., description="kebab-case identifier (e.g. 'pricing-card').")
    source_html: str = Field(..., description="Raw HTML of the selected element to extract from.")
    source_instance_id: str | None = Field(default=None, description="The data-ve-id of the source element.")
    source_page_slug: str | None = Field(default=None)
    source_version: int | None = Field(default=None)
    category: str = Field(default="custom")
    description: str = Field(default="")
    thumbnail: str = Field(default="🧱")


class UpdateComponentBody(BaseModel):
    name: str | None = None
    slug: str | None = None
    category: str | None = None
    description: str | None = None
    thumbnail: str | None = None
    template: str | None = None
    fields: list[dict[str, Any]] | None = None


class RenderBody(BaseModel):
    config: dict[str, Any] = Field(default_factory=dict)
    instance_id: str | None = Field(default=None)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.get("")
async def list_components(
    project_id: str,
    repo=Depends(get_repo),
    component_repo=Depends(get_project_component_repo),
):
    """List every saved component in the project."""
    project = await repo.get(project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    items = await component_repo.list_by_project(project_id)
    return [c.model_dump() for c in items]


@router.post("")
async def create_component(
    project_id: str,
    body: CreateComponentBody,
    repo=Depends(get_repo),
    component_repo=Depends(get_project_component_repo),
):
    """Extract a draft component from a chunk of HTML and persist it.

    Returns the saved ProjectComponent. The frontend usually opens a
    refinement modal next, then calls PUT to commit the user's edits.
    """
    project = await repo.get(project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    _validate_slug(body.slug)
    existing = await component_repo.get_by_slug(project_id, body.slug)
    if existing is not None:
        raise HTTPException(
            status_code=409,
            detail=f"slug '{body.slug}' already exists in this project — rename and retry",
        )

    draft = _extract_component(
        body.source_html,
        default_name=body.name,
        default_slug=body.slug,
    )

    component = ProjectComponent(
        project_id=project_id,
        slug=body.slug,
        name=body.name,
        category=body.category or draft.get("category", "custom"),
        description=body.description or draft.get("description", ""),
        thumbnail=body.thumbnail or draft.get("thumbnail", "🧱"),
        template=draft["template"],
        fields=[BlockFieldModel(**f) for f in draft["fields"]],
        source_instance_id=body.source_instance_id,
        source_page_slug=body.source_page_slug,
        source_version=body.source_version,
    )
    saved = await component_repo.create(component)
    logger.info(
        "Component extracted: project=%s slug=%s fields=%d",
        project_id, saved.slug, len(saved.fields),
    )
    return saved.model_dump()


@router.get("/{component_id}")
async def get_component(
    project_id: str,
    component_id: str,
    component_repo=Depends(get_project_component_repo),
):
    component = await component_repo.get(component_id)
    if component is None or component.project_id != project_id:
        raise HTTPException(status_code=404, detail="Component not found")
    return component.model_dump()


@router.put("/{component_id}")
async def update_component(
    project_id: str,
    component_id: str,
    body: UpdateComponentBody,
    component_repo=Depends(get_project_component_repo),
):
    component = await component_repo.get(component_id)
    if component is None or component.project_id != project_id:
        raise HTTPException(status_code=404, detail="Component not found")

    if body.slug is not None and body.slug != component.slug:
        _validate_slug(body.slug)
        existing = await component_repo.get_by_slug(project_id, body.slug)
        if existing is not None and existing.id != component_id:
            raise HTTPException(status_code=409, detail=f"slug '{body.slug}' already taken")
        component.slug = body.slug

    if body.name is not None:
        component.name = body.name
    if body.category is not None:
        component.category = body.category
    if body.description is not None:
        component.description = body.description
    if body.thumbnail is not None:
        component.thumbnail = body.thumbnail
    if body.template is not None:
        component.template = body.template
    if body.fields is not None:
        component.fields = [BlockFieldModel(**f) for f in body.fields]
    component.updated_at = datetime.now(timezone.utc).isoformat()

    await component_repo.update(component)
    return component.model_dump()


@router.delete("/{component_id}")
async def delete_component(
    project_id: str,
    component_id: str,
    component_repo=Depends(get_project_component_repo),
):
    component = await component_repo.get(component_id)
    if component is None or component.project_id != project_id:
        raise HTTPException(status_code=404, detail="Component not found")
    deleted = await component_repo.delete(component_id)
    return {"ok": deleted}


@router.post("/{component_id}/render")
async def render_component(
    project_id: str,
    component_id: str,
    body: RenderBody,
    component_repo=Depends(get_project_component_repo),
):
    """Render the component to HTML using a config dict.

    Returns ``{"html": "<section …>…</section>"}``. Used by the agent to
    insert a project component (same shape the builtin `render_block`
    tool returns).
    """
    component = await component_repo.get(component_id)
    if component is None or component.project_id != project_id:
        raise HTTPException(status_code=404, detail="Component not found")

    definition = {
        "id": component.slug,
        "name": component.name,
        "category": component.category,
        "description": component.description,
        "thumbnail": component.thumbnail,
        "template": component.template,
        "fields": [f.model_dump() for f in component.fields],
    }
    html = _render_block_html(definition, body.config, instance_id=body.instance_id)
    return {"html": html, "component_id": component_id, "slug": component.slug}
