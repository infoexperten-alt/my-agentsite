"""Data access layer for AgentSite projects, pages, and versions."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from ..models import AgentConfig, AgentRun, ChatMessage, Page, PageVersion, Project, StyleSpec
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
            """INSERT INTO versions (id, page_id, version_number, status, prompt, usage, files, error, created_at, completed_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                version.id,
                version.page_id,
                version.version_number,
                version.status,
                version.prompt,
                json.dumps(version.usage),
                json.dumps(version.files),
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
            """UPDATE versions SET status=?, usage=?, files=?, error=?, completed_at=? WHERE id=?""",
            (
                version.status,
                json.dumps(version.usage),
                json.dumps(version.files),
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
            files=json.loads(row["files"]) if row["files"] else {},
            error=row["error"],
            created_at=row["created_at"],
            completed_at=row["completed_at"],
        )


class MessageRepository:
    """CRUD operations for chat messages within page builder sessions."""

    def __init__(self, db: Database) -> None:
        self._db = db

    async def create(self, msg: ChatMessage) -> ChatMessage:
        """Insert a new message."""
        await self._db.conn.execute(
            """INSERT INTO messages (id, page_id, role, content, image, meta, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (
                msg.id,
                msg.page_id,
                msg.role,
                msg.content,
                msg.image,
                json.dumps(msg.meta),
                msg.created_at,
            ),
        )
        await self._db.conn.commit()
        return msg

    async def list_by_page(self, page_id: str) -> list[ChatMessage]:
        """List all messages for a page, ordered chronologically."""
        cursor = await self._db.conn.execute(
            "SELECT * FROM messages WHERE page_id = ? ORDER BY created_at ASC",
            (page_id,),
        )
        rows = await cursor.fetchall()
        return [self._row_to_message(row) for row in rows]

    async def delete_by_page(self, page_id: str) -> None:
        """Delete all messages for a page."""
        await self._db.conn.execute(
            "DELETE FROM messages WHERE page_id = ?", (page_id,)
        )
        await self._db.conn.commit()

    @staticmethod
    def _row_to_message(row) -> ChatMessage:
        return ChatMessage(
            id=row["id"],
            page_id=row["page_id"],
            role=row["role"],
            content=row["content"],
            image=row["image"],
            meta=json.loads(row["meta"]) if row["meta"] else {},
            created_at=row["created_at"],
        )


class AgentConfigRepository:
    """CRUD operations for agent configurations."""

    def __init__(self, db: Database) -> None:
        self._db = db

    async def list_all(self) -> list[AgentConfig]:
        """Fetch all agent configs."""
        cursor = await self._db.conn.execute(
            "SELECT * FROM agent_configs ORDER BY agent_name"
        )
        rows = await cursor.fetchall()
        return [self._row_to_config(row) for row in rows]

    async def get(self, agent_name: str) -> AgentConfig | None:
        """Fetch a single agent config by name."""
        cursor = await self._db.conn.execute(
            "SELECT * FROM agent_configs WHERE agent_name = ?", (agent_name,)
        )
        row = await cursor.fetchone()
        if row is None:
            return None
        return self._row_to_config(row)

    async def update(self, config: AgentConfig) -> None:
        """Update an agent config."""
        config.updated_at = datetime.now(timezone.utc).isoformat()
        await self._db.conn.execute(
            """UPDATE agent_configs SET enabled=?, model=?, temperature=?,
               system_prompt_override=?, updated_at=? WHERE agent_name=?""",
            (
                1 if config.enabled else 0,
                config.model,
                config.temperature,
                config.system_prompt_override,
                config.updated_at,
                config.agent_name,
            ),
        )
        await self._db.conn.commit()

    @staticmethod
    def _row_to_config(row: Any) -> AgentConfig:
        return AgentConfig(
            agent_name=row["agent_name"],
            enabled=bool(row["enabled"]),
            model=row["model"],
            temperature=row["temperature"],
            system_prompt_override=row["system_prompt_override"],
            updated_at=row["updated_at"],
        )


class AgentRunRepository:
    """CRUD operations for agent run records."""

    def __init__(self, db: Database) -> None:
        self._db = db

    async def create(self, run: AgentRun) -> AgentRun:
        """Insert a new agent run."""
        await self._db.conn.execute(
            """INSERT INTO agent_runs
               (id, project_id, page_slug, version, agent_name, status,
                started_at, completed_at, input_tokens, output_tokens, cost, output_summary)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                run.id,
                run.project_id,
                run.page_slug,
                run.version,
                run.agent_name,
                run.status,
                run.started_at,
                run.completed_at,
                run.input_tokens,
                run.output_tokens,
                run.cost,
                json.dumps(run.output_summary),
            ),
        )
        await self._db.conn.commit()
        return run

    async def update(self, run: AgentRun) -> None:
        """Update an agent run record."""
        await self._db.conn.execute(
            """UPDATE agent_runs SET status=?, completed_at=?,
               input_tokens=?, output_tokens=?, cost=?, output_summary=?
               WHERE id=?""",
            (
                run.status,
                run.completed_at,
                run.input_tokens,
                run.output_tokens,
                run.cost,
                json.dumps(run.output_summary),
                run.id,
            ),
        )
        await self._db.conn.commit()

    async def list_recent(self, limit: int = 50) -> list[AgentRun]:
        """List recent agent runs ordered by start time."""
        cursor = await self._db.conn.execute(
            "SELECT * FROM agent_runs ORDER BY started_at DESC LIMIT ?", (limit,)
        )
        rows = await cursor.fetchall()
        return [self._row_to_run(row) for row in rows]

    async def get_stats(self) -> dict:
        """Get aggregated agent stats."""
        cursor = await self._db.conn.execute("""
            SELECT
                agent_name,
                COUNT(*) as total_runs,
                SUM(input_tokens) as total_input_tokens,
                SUM(output_tokens) as total_output_tokens,
                SUM(cost) as total_cost,
                AVG(
                    CASE WHEN completed_at IS NOT NULL AND started_at IS NOT NULL
                    THEN (julianday(completed_at) - julianday(started_at)) * 86400
                    ELSE NULL END
                ) as avg_duration_seconds
            FROM agent_runs
            WHERE status = 'completed'
            GROUP BY agent_name
        """)
        rows = await cursor.fetchall()
        per_agent = {}
        total_runs = 0
        total_cost = 0.0
        total_duration = 0.0
        duration_count = 0
        for row in rows:
            name = row["agent_name"]
            runs = row["total_runs"]
            cost = row["total_cost"] or 0.0
            avg_dur = row["avg_duration_seconds"]
            per_agent[name] = {
                "total_runs": runs,
                "total_input_tokens": row["total_input_tokens"] or 0,
                "total_output_tokens": row["total_output_tokens"] or 0,
                "total_cost": round(cost, 4),
                "avg_duration_seconds": round(avg_dur, 1) if avg_dur else None,
            }
            total_runs += runs
            total_cost += cost
            if avg_dur is not None:
                total_duration += avg_dur * runs
                duration_count += runs

        return {
            "total_runs": total_runs,
            "total_cost": round(total_cost, 4),
            "avg_duration_seconds": round(total_duration / duration_count, 1) if duration_count else None,
            "per_agent": per_agent,
        }

    @staticmethod
    def _row_to_run(row: Any) -> AgentRun:
        return AgentRun(
            id=row["id"],
            project_id=row["project_id"],
            page_slug=row["page_slug"],
            version=row["version"],
            agent_name=row["agent_name"],
            status=row["status"],
            started_at=row["started_at"],
            completed_at=row["completed_at"],
            input_tokens=row["input_tokens"],
            output_tokens=row["output_tokens"],
            cost=row["cost"],
            output_summary=json.loads(row["output_summary"]) if row["output_summary"] else {},
        )
