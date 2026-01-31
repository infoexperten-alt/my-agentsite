"""Tests for SQLite storage layer."""

from __future__ import annotations

import pytest

from agentsite.models import Project, ProjectStatus
from agentsite.storage.database import Database
from agentsite.storage.repository import ProjectRepository


@pytest.fixture
async def db(tmp_path):
    """Create an in-memory test database."""
    database = Database(db_path=tmp_path / "test.db")
    await database.connect()
    yield database
    await database.close()


@pytest.fixture
async def repo(db):
    return ProjectRepository(db)


class TestDatabase:
    @pytest.mark.asyncio
    async def test_connect_creates_tables(self, tmp_path):
        db = Database(db_path=tmp_path / "test2.db")
        await db.connect()
        # Verify tables exist
        cursor = await db.conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='projects'"
        )
        row = await cursor.fetchone()
        assert row is not None
        await db.close()


class TestProjectRepository:
    @pytest.mark.asyncio
    async def test_create_and_get(self, repo):
        project = Project(name="Test", prompt="Build it")
        await repo.create(project)

        loaded = await repo.get(project.id)
        assert loaded is not None
        assert loaded.name == "Test"
        assert loaded.prompt == "Build it"

    @pytest.mark.asyncio
    async def test_list_all(self, repo):
        await repo.create(Project(name="A"))
        await repo.create(Project(name="B"))

        projects = await repo.list_all()
        assert len(projects) == 2

    @pytest.mark.asyncio
    async def test_update(self, repo):
        project = Project(name="Before")
        await repo.create(project)

        project.name = "After"
        project.status = ProjectStatus.completed
        await repo.update(project)

        loaded = await repo.get(project.id)
        assert loaded.name == "After"
        assert loaded.status == ProjectStatus.completed

    @pytest.mark.asyncio
    async def test_delete(self, repo):
        project = Project(name="Deletable")
        await repo.create(project)
        await repo.delete(project.id)

        loaded = await repo.get(project.id)
        assert loaded is None

    @pytest.mark.asyncio
    async def test_get_nonexistent(self, repo):
        loaded = await repo.get("nope")
        assert loaded is None

    @pytest.mark.asyncio
    async def test_record_generation(self, repo):
        project = Project(name="Gen Test")
        await repo.create(project)

        gen_id = await repo.record_generation(project.id, "2024-01-01T00:00:00Z")
        assert gen_id is not None
        assert gen_id > 0

    @pytest.mark.asyncio
    async def test_update_generation(self, repo):
        project = Project(name="Gen Update")
        await repo.create(project)

        gen_id = await repo.record_generation(project.id, "2024-01-01T00:00:00Z")
        await repo.update_generation(
            gen_id,
            completed_at="2024-01-01T00:01:00Z",
            status="completed",
            usage={"total_tokens": 1000},
        )
        # No error means success
