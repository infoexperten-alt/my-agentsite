"""SQLite database management via aiosqlite."""

from __future__ import annotations

import logging
from pathlib import Path

import aiosqlite

from ..config import settings

logger = logging.getLogger("agentsite.database")

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL DEFAULT 'Untitled Project',
    description TEXT NOT NULL DEFAULT '',
    model TEXT NOT NULL DEFAULT '',
    style_spec TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pages (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    slug TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    prompt TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(project_id, slug)
);

CREATE TABLE IF NOT EXISTS versions (
    id TEXT PRIMARY KEY,
    page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'generating',
    prompt TEXT NOT NULL DEFAULT '',
    usage TEXT DEFAULT '{}',
    files TEXT DEFAULT '{}',
    error TEXT,
    created_at TEXT NOT NULL,
    completed_at TEXT,
    UNIQUE(page_id, version_number)
);

CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'user',
    content TEXT NOT NULL DEFAULT '',
    image TEXT,
    meta TEXT DEFAULT '{}',
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_configs (
    agent_name TEXT PRIMARY KEY,
    enabled INTEGER NOT NULL DEFAULT 1,
    model TEXT NOT NULL DEFAULT '',
    temperature REAL NOT NULL DEFAULT 0.5,
    system_prompt_override TEXT,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_runs (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    page_slug TEXT NOT NULL DEFAULT '',
    version INTEGER NOT NULL DEFAULT 1,
    agent_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'running',
    started_at TEXT NOT NULL,
    completed_at TEXT,
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    cost REAL NOT NULL DEFAULT 0.0,
    output_summary TEXT DEFAULT '{}'
);
"""

# Migration: drop old tables if they exist with old schema
MIGRATION_SQL = """
-- Drop legacy tables that no longer match the schema
DROP TABLE IF EXISTS generations;
"""


class Database:
    """Async SQLite database wrapper."""

    def __init__(self, db_path: Path | None = None) -> None:
        self._path = db_path or settings.db_path
        self._conn: aiosqlite.Connection | None = None

    async def connect(self) -> None:
        """Open the database connection and create tables."""
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._conn = await aiosqlite.connect(str(self._path))
        self._conn.row_factory = aiosqlite.Row
        await self._conn.execute("PRAGMA foreign_keys = ON")
        await self._migrate()
        await self._conn.executescript(SCHEMA_SQL)
        await self._conn.commit()
        await self._seed_agent_configs()
        logger.info("Database connected: %s", self._path)

    async def _migrate(self) -> None:
        """Handle migrations from old schema."""
        # Check if old projects table has columns we need to drop
        cursor = await self._conn.execute("PRAGMA table_info(projects)")
        columns = {row[1] for row in await cursor.fetchall()}

        if "prompt" in columns or "status" in columns or "site_plan" in columns:
            # Old schema detected — rename and recreate
            logger.info("Migrating database from old schema...")
            await self._conn.executescript("""
                DROP TABLE IF EXISTS generations;
                ALTER TABLE projects RENAME TO _old_projects;
            """)
            await self._conn.executescript(SCHEMA_SQL)
            # Migrate old project data
            try:
                old_cursor = await self._conn.execute("SELECT * FROM _old_projects")
                old_rows = await old_cursor.fetchall()
                for row in old_rows:
                    await self._conn.execute(
                        """INSERT OR IGNORE INTO projects (id, name, description, model, style_spec, created_at, updated_at)
                           VALUES (?, ?, ?, ?, ?, ?, ?)""",
                        (
                            row["id"],
                            row["name"],
                            row["prompt"] if "prompt" in columns else "",
                            row["model"],
                            row["style_spec"] if "style_spec" in columns else None,
                            row["created_at"],
                            row["updated_at"],
                        ),
                    )
                await self._conn.execute("DROP TABLE _old_projects")
                await self._conn.commit()
                logger.info("Migration complete — %d projects migrated", len(old_rows))
            except Exception:
                logger.warning("Migration of old data failed, starting fresh")
                await self._conn.execute("DROP TABLE IF EXISTS _old_projects")
                await self._conn.commit()
        else:
            # No old schema or already migrated — just clean up legacy tables
            await self._conn.executescript(MIGRATION_SQL)
            await self._conn.commit()

        # Add files column to versions table if missing (incremental migration)
        cursor = await self._conn.execute("PRAGMA table_info(versions)")
        version_columns = {row[1] for row in await cursor.fetchall()}
        if version_columns and "files" not in version_columns:
            logger.info("Adding 'files' column to versions table...")
            await self._conn.execute("ALTER TABLE versions ADD COLUMN files TEXT DEFAULT '{}'")
            await self._conn.commit()

    async def _seed_agent_configs(self) -> None:
        """Insert default agent configs if they don't exist."""
        from datetime import datetime, timezone

        now = datetime.now(timezone.utc).isoformat()
        defaults = [
            ("pm", 1, "", 0.3, None, now),
            ("designer", 1, "", 0.5, None, now),
            ("developer", 1, "", 0.2, None, now),
            ("reviewer", 1, "", 0.1, None, now),
        ]
        for row in defaults:
            await self._conn.execute(
                """INSERT OR IGNORE INTO agent_configs
                   (agent_name, enabled, model, temperature, system_prompt_override, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                row,
            )
        await self._conn.commit()

    async def close(self) -> None:
        """Close the database connection."""
        if self._conn:
            await self._conn.close()
            self._conn = None

    @property
    def conn(self) -> aiosqlite.Connection:
        if self._conn is None:
            raise RuntimeError("Database not connected. Call connect() first.")
        return self._conn
