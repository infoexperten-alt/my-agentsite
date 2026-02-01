"""Serve generated sites for live preview in iframe."""

from __future__ import annotations

import logging
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse, Response

from ..deps import get_page_repo, get_pm, get_version_repo

logger = logging.getLogger("agentsite.api.preview")

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
async def preview_page_latest(
    project_id: str,
    slug: str,
    pm=Depends(get_pm),
    page_repo=Depends(get_page_repo),
    version_repo=Depends(get_version_repo),
):
    """Serve the index.html of the latest version of a page."""
    # Cross-check: page must exist in DB to prevent serving stale files
    page = await page_repo.get_by_slug(project_id, slug)
    if page is None:
        raise HTTPException(status_code=404, detail=f"Page '{slug}' not found")
    version = _find_latest_version(pm, project_id, slug)
    if version is None:
        # Try DB fallback: find latest version from DB
        latest_ver = await version_repo.get_latest(page.id)
        if latest_ver and latest_ver.files:
            version = latest_ver.version_number
        else:
            raise HTTPException(status_code=404, detail=f"No versions found for page '{slug}'")
    return await _serve_version_file(pm, project_id, slug, version, "index.html", page_repo, version_repo)


@router.get("/{project_id}/{slug}/v/{version:int}")
async def preview_page_version(
    project_id: str,
    slug: str,
    version: int,
    pm=Depends(get_pm),
    page_repo=Depends(get_page_repo),
    version_repo=Depends(get_version_repo),
):
    """Serve the index.html of a specific version."""
    return await _serve_version_file(pm, project_id, slug, version, "index.html", page_repo, version_repo)


@router.get("/{project_id}/{slug}/v/{version:int}/{path:path}")
async def preview_version_file(
    project_id: str,
    slug: str,
    version: int,
    path: str,
    pm=Depends(get_pm),
    page_repo=Depends(get_page_repo),
    version_repo=Depends(get_version_repo),
):
    """Serve any file from a specific page version."""
    return await _serve_version_file(pm, project_id, slug, version, path, page_repo, version_repo)


async def _serve_version_file(pm, project_id: str, slug: str, version: int, path: str, page_repo=None, version_repo=None):
    """Resolve and serve a file from a version directory, with DB fallback."""
    vdir = pm.version_dir(project_id, slug, version)
    target = vdir / path

    # Prevent path traversal
    try:
        target.resolve().relative_to(vdir.resolve())
    except ValueError:
        raise HTTPException(status_code=403, detail="Access denied")

    if target.exists() and target.is_file():
        suffix = target.suffix.lower()
        media_type = _MIME_TYPES.get(suffix, "application/octet-stream")
        return FileResponse(target, media_type=media_type)

    # File not on disk — try DB fallback
    if version_repo and page_repo:
        page = await page_repo.get_by_slug(project_id, slug)
        if page:
            ver = await version_repo.get_by_number(page.id, version)
            if ver and ver.files:
                # Normalize path separators
                normalized_path = path.replace("\\", "/")
                content = ver.files.get(normalized_path)
                if content is not None:
                    logger.info("Serving %s from DB for project %s page %s v%d", path, project_id, slug, version)
                    # Lazy restore: write to disk for future requests
                    try:
                        pm.write_version_file(project_id, slug, version, normalized_path, content)
                    except Exception:
                        logger.warning("Failed to lazy-restore %s to disk", path)

                    suffix = Path(path).suffix.lower()
                    media_type = _MIME_TYPES.get(suffix, "application/octet-stream")
                    return Response(content=content, media_type=media_type)

    raise HTTPException(status_code=404, detail=f"File not found: {path}")
