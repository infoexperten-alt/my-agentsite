"""Persist visual edits made via htmlstudio in the PreviewFrame.

All HTML tagging/patching lives in the `htmlstudio` npm package on the
frontend. This module just writes the final edited HTML back to the
version directory on disk.
"""

from __future__ import annotations

import logging
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..deps import get_page_repo, get_pm, get_version_repo

logger = logging.getLogger("agentsite.api.edit")

router = APIRouter(prefix="/api/edit", tags=["edit"])


class SaveHtmlBody(BaseModel):
    html: str = Field(..., description="Full edited HTML for the page (already untagged on the client).")
    path: str = Field("index.html", description="File path within the version directory.")


@router.put("/{project_id}/{slug}/v/{version}/file")
async def save_html(
    project_id: str,
    slug: str,
    version: int,
    body: SaveHtmlBody,
    pm=Depends(get_pm),
    page_repo=Depends(get_page_repo),
    version_repo=Depends(get_version_repo),
):
    """Overwrite a single file inside a version directory with edited HTML.

    Used by the visual editor to persist patches the user made in the
    browser. Restricted to files inside the version dir (no traversal).
    """
    page = await page_repo.get_by_slug(project_id, slug)
    if page is None:
        raise HTTPException(status_code=404, detail=f"Page '{slug}' not found")

    vdir: Path = pm.version_dir(project_id, slug, version)
    if not vdir.exists():
        raise HTTPException(status_code=404, detail=f"Version v{version} not found on disk")

    target = vdir / body.path
    try:
        target.resolve().relative_to(vdir.resolve())
    except ValueError:
        raise HTTPException(status_code=403, detail="Access denied") from None

    if not target.exists():
        raise HTTPException(status_code=404, detail=f"File not found: {body.path}")

    target.write_text(body.html, encoding="utf-8")

    # Mirror into the version_repo file map so DB-backed serving stays in sync.
    try:
        ver = await version_repo.get_by_number(page.id, version)
        if ver is not None:
            files = dict(ver.files or {})
            files[body.path.replace("\\", "/")] = body.html
            ver.files = files
            await version_repo.update(ver)
    except Exception:
        logger.warning("Failed to mirror edited HTML into version_repo", exc_info=True)

    logger.info("Saved visual edit: %s/%s/v%d/%s (%d bytes)", project_id, slug, version, body.path, len(body.html))
    return {"ok": True, "bytes": len(body.html)}
