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


def _find_latest_version(pm, project_id: str, slug: str) -> int | None:
    """Find the highest version number that has files on disk."""
    page_dir = pm.page_dir(project_id, slug)
    if not page_dir.exists():
        return None
    versions = []
    for d in page_dir.iterdir():
        if d.is_dir() and d.name.startswith("v"):
            try:
                versions.append(int(d.name[1:]))
            except ValueError:
                continue
    return max(versions) if versions else None


@router.get("/{project_id}/{slug}")
async def preview_page_latest(project_id: str, slug: str, pm=Depends(get_pm)):
    """Serve the index.html of the latest version of a page."""
    version = _find_latest_version(pm, project_id, slug)
    if version is None:
        raise HTTPException(status_code=404, detail=f"No versions found for page '{slug}'")
    return await _serve_version_file(pm, project_id, slug, version, "index.html")


@router.get("/{project_id}/{slug}/v/{version:int}")
async def preview_page_version(project_id: str, slug: str, version: int, pm=Depends(get_pm)):
    """Serve the index.html of a specific version."""
    return await _serve_version_file(pm, project_id, slug, version, "index.html")


@router.get("/{project_id}/{slug}/v/{version:int}/{path:path}")
async def preview_version_file(
    project_id: str, slug: str, version: int, path: str, pm=Depends(get_pm)
):
    """Serve any file from a specific page version."""
    return await _serve_version_file(pm, project_id, slug, version, path)


async def _serve_version_file(pm, project_id: str, slug: str, version: int, path: str):
    """Resolve and serve a file from a version directory."""
    vdir = pm.version_dir(project_id, slug, version)
    target = vdir / path

    # Prevent path traversal
    try:
        target.resolve().relative_to(vdir.resolve())
    except ValueError:
        raise HTTPException(status_code=403, detail="Access denied")

    if not target.exists() or not target.is_file():
        raise HTTPException(status_code=404, detail=f"File not found: {path}")

    suffix = target.suffix.lower()
    media_type = _MIME_TYPES.get(suffix, "application/octet-stream")

    return FileResponse(target, media_type=media_type)
