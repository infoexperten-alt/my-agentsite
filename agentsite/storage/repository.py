"""Data access layer for AgentSite projects."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from ..models import Project, ProjectStatus, SitePlan, StyleSpec
from .database import Database


class ProjectRepository:
    """CRUD operations for projects stored in SQLite."""

    def __init__(self, db: Database) -> None:
        self._db = db

    async def create(self, project: Project) -> Project:
        """Insert a new project."""
        await self._db.conn.execute(
            """INSERT INTO projects (id, name, prompt, model, status, site_plan, style_spec, created_at, updated_at, usage)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                project.id,
                project.name,
                project.prompt,
                project.model,
                project.status.value,
                project.site_plan.model_dump_json() if project.site_plan else None,
                project.style_spec.model_dump_json() if project.style_spec else None,
                project.created_at,
                project.updated_at,
                json.dumps(project.usage),
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
            """UPDATE projects SET name=?, prompt=?, model=?, status=?, site_plan=?, style_spec=?,
               updated_at=?, usage=? WHERE id=?""",
            (
                project.name,
                project.prompt,
                project.model,
                project.status.value,
                project.site_plan.model_dump_json() if project.site_plan else None,
                project.style_spec.model_dump_json() if project.style_spec else None,
                project.updated_at,
                json.dumps(project.usage),
                project.id,
            ),
        )
        await self._db.conn.commit()

    async def delete(self, project_id: str) -> None:
        """Delete a project."""
        await self._db.conn.execute("DELETE FROM projects WHERE id = ?", (project_id,))
        await self._db.conn.commit()

    async def record_generation(
        self,
        project_id: str,
        started_at: str,
        *,
        completed_at: str | None = None,
        status: str = "running",
        usage: dict | None = None,
        error: str | None = None,
    ) -> int:
        """Insert a generation record and return its ID."""
        cursor = await self._db.conn.execute(
            """INSERT INTO generations (project_id, started_at, completed_at, status, usage, error)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (
                project_id,
                started_at,
                completed_at,
                status,
                json.dumps(usage or {}),
                error,
            ),
        )
        await self._db.conn.commit()
        return cursor.lastrowid

    async def update_generation(
        self,
        gen_id: int,
        *,
        completed_at: str | None = None,
        status: str | None = None,
        usage: dict | None = None,
        error: str | None = None,
    ) -> None:
        """Update a generation record."""
        parts = []
        values: list[Any] = []
        if completed_at is not None:
            parts.append("completed_at = ?")
            values.append(completed_at)
        if status is not None:
            parts.append("status = ?")
            values.append(status)
        if usage is not None:
            parts.append("usage = ?")
            values.append(json.dumps(usage))
        if error is not None:
            parts.append("error = ?")
            values.append(error)

        if parts:
            values.append(gen_id)
            await self._db.conn.execute(
                f"UPDATE generations SET {', '.join(parts)} WHERE id = ?", values
            )
            await self._db.conn.commit()

    @staticmethod
    def _row_to_project(row: Any) -> Project:
        """Convert a database row to a Project model."""
        site_plan = None
        if row["site_plan"]:
            site_plan = SitePlan.model_validate_json(row["site_plan"])

        style_spec = None
        if row["style_spec"]:
            style_spec = StyleSpec.model_validate_json(row["style_spec"])

        return Project(
            id=row["id"],
            name=row["name"],
            prompt=row["prompt"],
            model=row["model"],
            status=ProjectStatus(row["status"]),
            site_plan=site_plan,
            style_spec=style_spec,
            created_at=row["created_at"],
            updated_at=row["updated_at"],
            usage=json.loads(row["usage"]) if row["usage"] else {},
        )
