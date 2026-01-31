"""Serve generated sites for live preview in iframe."""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse, HTMLResponse

from ..deps import get_pm

router = APIRouter(prefix="/preview", tags=["preview"])

# MIME type mapping
_MIME_TYPES = {
    ".html": "text/html",
    ".css": "text/css",
    ".js": "application/javascript",
    ".json": "application/json",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
}


@router.get("/{project_id}")
async def preview_index(project_id: str, pm=Depends(get_pm)):
    """Serve the index.html of a generated site."""
    return await preview_file(project_id, "index.html", pm=pm)


@router.get("/{project_id}/{path:path}")
async def preview_file(project_id: str, path: str, pm=Depends(get_pm)):
    """Serve any file from the generated site."""
    site_dir = pm.site_dir(project_id)
    target = site_dir / path

    # Prevent path traversal
    try:
        target.resolve().relative_to(site_dir.resolve())
    except ValueError:
        raise HTTPException(status_code=403, detail="Access denied")

    if not target.exists() or not target.is_file():
        raise HTTPException(status_code=404, detail=f"File not found: {path}")

    suffix = target.suffix.lower()
    media_type = _MIME_TYPES.get(suffix, "application/octet-stream")

    return FileResponse(target, media_type=media_type)
