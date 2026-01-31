"""Image/asset upload endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, UploadFile

from ..deps import get_assets

router = APIRouter(tags=["assets"])


@router.post("/api/projects/{project_id}/assets")
async def upload_asset(project_id: str, file: UploadFile, assets=Depends(get_assets)):
    """Upload an image or asset file to a project."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    data = await file.read()
    if len(data) > 10 * 1024 * 1024:  # 10 MB limit
        raise HTTPException(status_code=413, detail="File too large (max 10 MB)")

    try:
        rel_path = assets.save_upload(project_id, file.filename, data)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    return {"path": rel_path, "filename": file.filename, "size": len(data)}


@router.get("/api/projects/{project_id}/assets")
async def list_assets(project_id: str, assets=Depends(get_assets)):
    """List all uploaded assets for a project."""
    return {"assets": assets.list_assets(project_id)}
