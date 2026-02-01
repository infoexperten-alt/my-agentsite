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
    """Manages project directories and files on disk.

    Filesystem layout::

        {base}/{project_id}/
        ├── project.json
        ├── assets/
        └── pages/
            ├── home/
            │   ├── v1/
            │   │   ├── index.html
            │   │   └── styles.css
            │   └── v2/
            │       └── index.html
            └── about/
                └── v1/
                    └── index.html
    """

    def __init__(self, base_dir: Path | None = None) -> None:
        self._base = base_dir or settings.projects_dir
        self._base.mkdir(parents=True, exist_ok=True)

    def project_dir(self, project_id: str) -> Path:
        return self._base / project_id

    def assets_dir(self, project_id: str) -> Path:
        return self.project_dir(project_id) / "assets"

    def pages_dir(self, project_id: str) -> Path:
        return self.project_dir(project_id) / "pages"

    def page_dir(self, project_id: str, slug: str) -> Path:
        return self.pages_dir(project_id) / slug

    def version_dir(self, project_id: str, slug: str, version: int) -> Path:
        return self.page_dir(project_id, slug) / f"v{version}"

    # -- Legacy compatibility --

    def site_dir(self, project_id: str) -> Path:
        """Legacy: return pages dir (used by asset handler)."""
        return self.pages_dir(project_id)

    # -- Project lifecycle --

    def create(self, project: Project) -> Path:
        """Create the project directory structure."""
        d = self.project_dir(project.id)
        d.mkdir(parents=True, exist_ok=True)
        (d / "pages").mkdir(exist_ok=True)
        (d / "assets").mkdir(exist_ok=True)

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

    # -- Version file operations --

    def ensure_version_dir(self, project_id: str, slug: str, version: int) -> Path:
        """Create and return the version directory."""
        d = self.version_dir(project_id, slug, version)
        d.mkdir(parents=True, exist_ok=True)
        return d

    def write_version_file(
        self, project_id: str, slug: str, version: int, rel_path: str, content: str
    ) -> None:
        """Write a file into a specific version directory."""
        vdir = self.version_dir(project_id, slug, version)
        target = vdir / rel_path

        # Prevent path traversal
        try:
            target.resolve().relative_to(vdir.resolve())
        except ValueError:
            raise ValueError(f"Path traversal denied: {rel_path}")

        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")

    def read_version_file(
        self, project_id: str, slug: str, version: int, rel_path: str
    ) -> str | None:
        """Read a file from a specific version directory."""
        vdir = self.version_dir(project_id, slug, version)
        target = vdir / rel_path

        try:
            target.resolve().relative_to(vdir.resolve())
        except ValueError:
            return None

        if not target.exists():
            return None
        return target.read_text(encoding="utf-8")

    def list_version_files(self, project_id: str, slug: str, version: int) -> list[str]:
        """List all files in a version directory."""
        vdir = self.version_dir(project_id, slug, version)
        if not vdir.exists():
            return []
        return sorted(
            str(f.relative_to(vdir)).replace("\\", "/") for f in vdir.rglob("*") if f.is_file()
        )

    # -- Export --

    def export_zip(self, project_id: str) -> bytes:
        """Package the entire project's pages directory as a ZIP."""
        pages = self.pages_dir(project_id)
        buf = io.BytesIO()

        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
            for file_path in pages.rglob("*"):
                if file_path.is_file():
                    arcname = str(file_path.relative_to(pages)).replace("\\", "/")
                    zf.write(file_path, arcname)

        return buf.getvalue()

    # -- Cleanup --

    def delete(self, project_id: str) -> None:
        """Remove a project directory entirely."""
        d = self.project_dir(project_id)
        if d.exists():
            shutil.rmtree(d)

    def delete_page(self, project_id: str, slug: str) -> None:
        """Remove a page's directory with retry for Windows file locks."""
        import time

        d = self.page_dir(project_id, slug)
        if not d.exists():
            return
        # Retry up to 3 times to handle Windows file lock issues
        for attempt in range(3):
            try:
                shutil.rmtree(d)
                return
            except PermissionError:
                if attempt < 2:
                    time.sleep(0.2 * (attempt + 1))
                else:
                    raise
