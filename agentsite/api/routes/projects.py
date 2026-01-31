"""Project CRUD endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ...models import Project
from ..deps import get_pm, get_repo

router = APIRouter(prefix="/api/projects", tags=["projects"])


class CreateProjectRequest(BaseModel):
    name: str = "Untitled Project"
    prompt: str = ""
    model: str = ""


@router.post("", response_model=Project)
async def create_project(req: CreateProjectRequest, repo=Depends(get_repo), pm=Depends(get_pm)):
    project = Project(name=req.name, prompt=req.prompt, model=req.model)
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


@router.get("/{project_id}/files")
async def list_files(project_id: str, pm=Depends(get_pm)):
    return {"files": pm.list_site_files(project_id)}


@router.get("/{project_id}/usage")
async def get_usage(project_id: str, repo=Depends(get_repo)):
    project = await repo.get(project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return project.usage


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
