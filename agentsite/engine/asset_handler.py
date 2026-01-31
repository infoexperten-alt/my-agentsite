"""Image and asset management for AgentSite projects."""

from __future__ import annotations

import shutil
import uuid
from pathlib import Path

from .project_manager import ProjectManager


class AssetHandler:
    """Handles image uploads and asset references for projects."""

    ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".ico"}

    def __init__(self, pm: ProjectManager) -> None:
        self._pm = pm

    def save_upload(self, project_id: str, filename: str, data: bytes) -> str:
        """Save an uploaded file and return its relative path.

        Returns the asset path relative to the project directory.
        """
        ext = Path(filename).suffix.lower()
        if ext not in self.ALLOWED_EXTENSIONS:
            raise ValueError(f"File type '{ext}' not allowed. Allowed: {self.ALLOWED_EXTENSIONS}")

        asset_id = uuid.uuid4().hex[:8]
        safe_name = f"{asset_id}{ext}"

        assets_dir = self._pm.assets_dir(project_id)
        assets_dir.mkdir(parents=True, exist_ok=True)

        target = assets_dir / safe_name
        target.write_bytes(data)

        return f"assets/{safe_name}"

    def list_assets(self, project_id: str) -> list[str]:
        """List all asset files for a project."""
        assets_dir = self._pm.assets_dir(project_id)
        if not assets_dir.exists():
            return []
        return sorted(f.name for f in assets_dir.iterdir() if f.is_file())

    def get_asset_path(self, project_id: str, filename: str) -> Path | None:
        """Get the full path to an asset file."""
        target = self._pm.assets_dir(project_id) / filename
        if target.exists():
            return target
        return None
