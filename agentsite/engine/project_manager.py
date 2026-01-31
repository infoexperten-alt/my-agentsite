"""Filesystem operations for AgentSite projects."""

from __future__ import annotations

import io
import json
import shutil
import zipfile
from pathlib import Path

from ..config import settings
from ..models import Project


class ProjectManager:
    """Manages project directories and files on disk."""

    def __init__(self, base_dir: Path | None = None) -> None:
        self._base = base_dir or settings.projects_dir
        self._base.mkdir(parents=True, exist_ok=True)

    def project_dir(self, project_id: str) -> Path:
        return self._base / project_id

    def site_dir(self, project_id: str) -> Path:
        return self.project_dir(project_id) / "site"

    def assets_dir(self, project_id: str) -> Path:
        return self.project_dir(project_id) / "assets"

    def create(self, project: Project) -> Path:
        """Create the project directory structure."""
        d = self.project_dir(project.id)
        d.mkdir(parents=True, exist_ok=True)
        (d / "site").mkdir(exist_ok=True)
        (d / "assets").mkdir(exist_ok=True)

        # Write project metadata
        meta_path = d / "project.json"
        meta_path.write_text(project.model_dump_json(indent=2), encoding="utf-8")
        return d

    def save_metadata(self, project: Project) -> None:
        """Update the project.json metadata file."""
        meta_path = self.project_dir(project.id) / "project.json"
        meta_path.write_text(project.model_dump_json(indent=2), encoding="utf-8")

    def load_metadata(self, project_id: str) -> Project | None:
        """Load project metadata from disk."""
        meta_path = self.project_dir(project_id) / "project.json"
        if not meta_path.exists():
            return None
        return Project.model_validate_json(meta_path.read_text(encoding="utf-8"))

    def list_projects(self) -> list[str]:
        """Return all project IDs on disk."""
        if not self._base.exists():
            return []
        return sorted(
            d.name for d in self._base.iterdir() if d.is_dir() and (d / "project.json").exists()
        )

    def list_site_files(self, project_id: str) -> list[str]:
        """List all files under the project's site directory."""
        site = self.site_dir(project_id)
        if not site.exists():
            return []
        return sorted(str(f.relative_to(site)).replace("\\", "/") for f in site.rglob("*") if f.is_file())

    def read_site_file(self, project_id: str, rel_path: str) -> str | None:
        """Read a file from the project's site directory."""
        target = self.site_dir(project_id) / rel_path
        site = self.site_dir(project_id)

        # Prevent path traversal
        try:
            target.resolve().relative_to(site.resolve())
        except ValueError:
            return None

        if not target.exists():
            return None
        return target.read_text(encoding="utf-8")

    def write_site_file(self, project_id: str, rel_path: str, content: str) -> None:
        """Write a file to the project's site directory."""
        site = self.site_dir(project_id)
        target = site / rel_path

        try:
            target.resolve().relative_to(site.resolve())
        except ValueError:
            raise ValueError(f"Path traversal denied: {rel_path}")

        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")

    def export_zip(self, project_id: str) -> bytes:
        """Package the project's site directory as a ZIP."""
        site = self.site_dir(project_id)
        buf = io.BytesIO()

        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
            for file_path in site.rglob("*"):
                if file_path.is_file():
                    arcname = str(file_path.relative_to(site)).replace("\\", "/")
                    zf.write(file_path, arcname)

        return buf.getvalue()

    def delete(self, project_id: str) -> None:
        """Remove a project directory entirely."""
        d = self.project_dir(project_id)
        if d.exists():
            shutil.rmtree(d)
