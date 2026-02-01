"""Data access layer for AgentSite projects, pages, and versions."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from ..models import Page, PageVersion, Project, StyleSpec
from .database import Database


class ProjectRepository:
    """CRUD operations for projects stored in SQLite."""

    def __init__(self, db: Database) -> None:
        self._db = db

    async def create(self, project: Project) -> Project:
        """Insert a new project."""
        await self._db.conn.execute(
            """INSERT INTO projects (id, name, description, model, style_spec, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (
                project.id,
                project.name,
                project.description,
                project.model,
                project.style_spec.model_dump_json() if project.style_spec else None,
                project.created_at,
                project.updated_at,
            ),
        )
        await self._db.conn.commit()
        return project

    async def get(self, project_id: str) -> Project | None:
        """Fetch a project by ID."""
        cursor = await self._db.conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,))
        row = await cursor.fetchone()
        if row is None:
            return None
        return self._row_to_project(row)

    async def list_all(self) -> list[Project]:
        """Fetch all projects ordered by creation date."""
        cursor = await self._db.conn.execute("SELECT * FROM projects ORDER BY created_at DESC")
        rows = await cursor.fetchall()
        return [self._row_to_project(row) for row in rows]

    async def update(self, project: Project) -> None:
        """Update an existing project."""
        project.updated_at = datetime.now(timezone.utc).isoformat()
        await self._db.conn.execute(
            """UPDATE projects SET name=?, description=?, model=?, style_spec=?,
               updated_at=? WHERE id=?""",
            (
                project.name,
                project.description,
                project.model,
                project.style_spec.model_dump_json() if project.style_spec else None,
                project.updated_at,
                project.id,
            ),
        )
        await self._db.conn.commit()

    async def delete(self, project_id: str) -> None:
        """Delete a project and all its pages/versions (via CASCADE)."""
        await self._db.conn.execute("DELETE FROM projects WHERE id = ?", (project_id,))
        await self._db.conn.commit()

    @staticmethod
    def _row_to_project(row: Any) -> Project:
        """Convert a database row to a Project model."""
        style_spec = None
        if row["style_spec"]:
            style_spec = StyleSpec.model_validate_json(row["style_spec"])

        return Project(
            id=row["id"],
            name=row["name"],
            description=row["description"],
            model=row["model"],
            style_spec=style_spec,
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )


class PageRepository:
    """CRUD operations for pages within projects."""

    def __init__(self, db: Database) -> None:
        self._db = db

    async def create(self, page: Page) -> Page:
        """Insert a new page."""
        await self._db.conn.execute(
            """INSERT INTO pages (id, project_id, slug, title, prompt, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (
                page.id,
                page.project_id,
                page.slug,
                page.title,
                page.prompt,
                page.created_at,
                page.updated_at,
            ),
        )
        await self._db.conn.commit()
        return page

    async def get(self, page_id: str) -> Page | None:
        """Fetch a page by ID."""
        cursor = await self._db.conn.execute("SELECT * FROM pages WHERE id = ?", (page_id,))
        row = await cursor.fetchone()
        if row is None:
            return None
        return self._row_to_page(row)

    async def get_by_slug(self, project_id: str, slug: str) -> Page | None:
        """Fetch a page by project ID and slug."""
        cursor = await self._db.conn.execute(
            "SELECT * FROM pages WHERE project_id = ? AND slug = ?", (project_id, slug)
        )
        row = await cursor.fetchone()
        if row is None:
            return None
        return self._row_to_page(row)

    async def list_by_project(self, project_id: str) -> list[Page]:
        """List all pages for a project."""
        cursor = await self._db.conn.execute(
            "SELECT * FROM pages WHERE project_id = ? ORDER BY created_at ASC", (project_id,)
        )
        rows = await cursor.fetchall()
        return [self._row_to_page(row) for row in rows]

    async def update(self, page: Page) -> None:
        """Update a page."""
        page.updated_at = datetime.now(timezone.utc).isoformat()
        await self._db.conn.execute(
            """UPDATE pages SET slug=?, title=?, prompt=?, updated_at=? WHERE id=?""",
            (page.slug, page.title, page.prompt, page.updated_at, page.id),
        )
        await self._db.conn.commit()

    async def delete(self, page_id: str) -> None:
        """Delete a page and all its versions (via CASCADE)."""
        await self._db.conn.execute("DELETE FROM pages WHERE id = ?", (page_id,))
        await self._db.conn.commit()

    async def delete_by_slug(self, project_id: str, slug: str) -> None:
        """Delete a page by project ID and slug."""
        await self._db.conn.execute(
            "DELETE FROM pages WHERE project_id = ? AND slug = ?", (project_id, slug)
        )
        await self._db.conn.commit()

    @staticmethod
    def _row_to_page(row: Any) -> Page:
        return Page(
            id=row["id"],
            project_id=row["project_id"],
            slug=row["slug"],
            title=row["title"],
            prompt=row["prompt"],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )


class VersionRepository:
    """CRUD operations for page versions."""

    def __init__(self, db: Database) -> None:
        self._db = db

    async def create(self, version: PageVersion) -> PageVersion:
        """Insert a new version."""
        await self._db.conn.execute(
            """INSERT INTO versions (id, page_id, version_number, status, prompt, usage, error, created_at, completed_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                version.id,
                version.page_id,
                version.version_number,
                version.status,
                version.prompt,
                json.dumps(version.usage),
                version.error,
                version.created_at,
                version.completed_at,
            ),
        )
        await self._db.conn.commit()
        return version

    async def get(self, version_id: str) -> PageVersion | None:
        """Fetch a version by ID."""
        cursor = await self._db.conn.execute("SELECT * FROM versions WHERE id = ?", (version_id,))
        row = await cursor.fetchone()
        if row is None:
            return None
        return self._row_to_version(row)

    async def get_by_number(self, page_id: str, version_number: int) -> PageVersion | None:
        """Fetch a specific version by page ID and version number."""
        cursor = await self._db.conn.execute(
            "SELECT * FROM versions WHERE page_id = ? AND version_number = ?",
            (page_id, version_number),
        )
        row = await cursor.fetchone()
        if row is None:
            return None
        return self._row_to_version(row)

    async def list_by_page(self, page_id: str) -> list[PageVersion]:
        """List all versions for a page, ordered by version number."""
        cursor = await self._db.conn.execute(
            "SELECT * FROM versions WHERE page_id = ? ORDER BY version_number ASC", (page_id,)
        )
        rows = await cursor.fetchall()
        return [self._row_to_version(row) for row in rows]

    async def get_latest(self, page_id: str) -> PageVersion | None:
        """Get the latest version for a page."""
        cursor = await self._db.conn.execute(
            "SELECT * FROM versions WHERE page_id = ? ORDER BY version_number DESC LIMIT 1",
            (page_id,),
        )
        row = await cursor.fetchone()
        if row is None:
            return None
        return self._row_to_version(row)

    async def next_version_number(self, page_id: str) -> int:
        """Get the next version number for a page."""
        cursor = await self._db.conn.execute(
            "SELECT MAX(version_number) FROM versions WHERE page_id = ?", (page_id,)
        )
        row = await cursor.fetchone()
        current_max = row[0] if row[0] is not None else 0
        return current_max + 1

    async def update(self, version: PageVersion) -> None:
        """Update a version record."""
        await self._db.conn.execute(
            """UPDATE versions SET status=?, usage=?, error=?, completed_at=? WHERE id=?""",
            (
                version.status,
                json.dumps(version.usage),
                version.error,
                version.completed_at,
                version.id,
            ),
        )
        await self._db.conn.commit()

    @staticmethod
    def _row_to_version(row: Any) -> PageVersion:
        return PageVersion(
            id=row["id"],
            page_id=row["page_id"],
            version_number=row["version_number"],
            status=row["status"],
            prompt=row["prompt"],
            usage=json.loads(row["usage"]) if row["usage"] else {},
            error=row["error"],
            created_at=row["created_at"],
            completed_at=row["completed_at"],
        )
