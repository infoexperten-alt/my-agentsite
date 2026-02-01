"""Project CRUD and page management endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ...models import Page, Project
from ..deps import get_page_repo, get_pm, get_repo, get_version_repo

router = APIRouter(prefix="/api/projects", tags=["projects"])


# -- Request models --

class CreateProjectRequest(BaseModel):
    name: str = "Untitled Project"
    description: str = ""
    model: str = ""


class CreatePageRequest(BaseModel):
    slug: str
    title: str = ""
    prompt: str = ""


# -- Project CRUD --

@router.post("", response_model=Project)
async def create_project(req: CreateProjectRequest, repo=Depends(get_repo), pm=Depends(get_pm)):
    project = Project(name=req.name, description=req.description, model=req.model)
    pm.create(project)
    await repo.create(project)
    return project


@router.get("", response_model=list[Project])
async def list_projects(repo=Depends(get_repo)):
    return await repo.list_all()


@router.get("/{project_id}", response_model=Project)
async def get_project(project_id: str, repo=Depends(get_repo)):
    project = await repo.get(project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.delete("/{project_id}")
async def delete_project(project_id: str, repo=Depends(get_repo), pm=Depends(get_pm)):
    project = await repo.get(project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    await repo.delete(project_id)
    pm.delete(project_id)
    return {"deleted": project_id}


@router.get("/{project_id}/export")
async def export_zip(project_id: str, pm=Depends(get_pm)):
    from fastapi.responses import Response

    try:
        data = pm.export_zip(project_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Project not found or empty")

    return Response(
        content=data,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename={project_id}.zip"},
    )


# -- Page CRUD --

@router.post("/{project_id}/pages", response_model=Page)
async def create_page(
    project_id: str,
    req: CreatePageRequest,
    repo=Depends(get_repo),
    page_repo=Depends(get_page_repo),
    pm=Depends(get_pm),
):
    project = await repo.get(project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    # Check for duplicate slug
    existing = await page_repo.get_by_slug(project_id, req.slug)
    if existing:
        raise HTTPException(status_code=409, detail=f"Page with slug '{req.slug}' already exists")

    page = Page(
        project_id=project_id,
        slug=req.slug,
        title=req.title or req.slug.replace("-", " ").title(),
        prompt=req.prompt,
    )
    await page_repo.create(page)
    return page


@router.get("/{project_id}/pages", response_model=list[Page])
async def list_pages(project_id: str, page_repo=Depends(get_page_repo)):
    return await page_repo.list_by_project(project_id)


@router.get("/{project_id}/pages/{slug}", response_model=Page)
async def get_page(project_id: str, slug: str, page_repo=Depends(get_page_repo)):
    page = await page_repo.get_by_slug(project_id, slug)
    if page is None:
        raise HTTPException(status_code=404, detail="Page not found")
    return page


@router.delete("/{project_id}/pages/{slug}")
async def delete_page(
    project_id: str,
    slug: str,
    page_repo=Depends(get_page_repo),
    pm=Depends(get_pm),
):
    page = await page_repo.get_by_slug(project_id, slug)
    if page is None:
        raise HTTPException(status_code=404, detail="Page not found")
    await page_repo.delete(page.id)
    pm.delete_page(project_id, slug)
    return {"deleted": slug}


# -- Version listing --

@router.get("/{project_id}/pages/{slug}/versions")
async def list_versions(
    project_id: str,
    slug: str,
    page_repo=Depends(get_page_repo),
    version_repo=Depends(get_version_repo),
):
    page = await page_repo.get_by_slug(project_id, slug)
    if page is None:
        raise HTTPException(status_code=404, detail="Page not found")
    versions = await version_repo.list_by_page(page.id)
    return [v.model_dump() for v in versions]


@router.get("/{project_id}/pages/{slug}/versions/{version_number:int}/files")
async def list_version_files(
    project_id: str,
    slug: str,
    version_number: int,
    pm=Depends(get_pm),
):
    files = pm.list_version_files(project_id, slug, version_number)
    return {"files": files}
