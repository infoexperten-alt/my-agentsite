"""Brand extraction endpoint (Phase 8)."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from ...agents.brand_extractor import extract_from_image, extract_from_pdf, extract_from_url
from ..deps import get_repo, guard_external_url

logger = logging.getLogger("agentsite.api.brand")
router = APIRouter(prefix="/api/projects", tags=["brand"])


class BrandUrlRequest(BaseModel):
    url: str
    persist: bool = True  # save extracted StyleSpec to the project


@router.post("/{project_id}/brand/extract/url")
async def extract_url(project_id: str, req: BrandUrlRequest, repo=Depends(get_repo)):
    project = await repo.get(project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    safe_url = guard_external_url(req.url)
    spec = extract_from_url(safe_url)
    if req.persist:
        project.style_spec = spec
        await repo.update(project)
    return {"style_spec": spec.model_dump(), "source": "url", "url": safe_url}


@router.post("/{project_id}/brand/extract/image")
async def extract_image(
    project_id: str,
    file: UploadFile = File(...),
    persist: bool = Form(default=True),
    repo=Depends(get_repo),
):
    project = await repo.get(project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file")
    if len(content) > 10 * 1024 * 1024:  # 10MB cap
        raise HTTPException(status_code=413, detail="File too large (max 10MB)")
    spec = extract_from_image(content, filename=file.filename or "")
    if persist:
        project.style_spec = spec
        await repo.update(project)
    return {"style_spec": spec.model_dump(), "source": "image", "filename": file.filename}


@router.post("/{project_id}/brand/extract/pdf")
async def extract_pdf(
    project_id: str,
    file: UploadFile = File(...),
    persist: bool = Form(default=True),
    repo=Depends(get_repo),
):
    project = await repo.get(project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file")
    if len(content) > 25 * 1024 * 1024:  # 25MB cap for PDFs
        raise HTTPException(status_code=413, detail="File too large (max 25MB)")
    spec = extract_from_pdf(content)
    if persist:
        project.style_spec = spec
        await repo.update(project)
    return {"style_spec": spec.model_dump(), "source": "pdf", "filename": file.filename}
