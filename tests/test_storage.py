"""Tests for SQLite storage layer."""

from __future__ import annotations

import pytest

from agentsite.models import Page, PageVersion, Project
from agentsite.storage.database import Database
from agentsite.storage.repository import PageRepository, ProjectRepository, VersionRepository


@pytest.fixture
async def db(tmp_path):
    """Create a test database."""
    database = Database(db_path=tmp_path / "test.db")
    await database.connect()
    yield database
    await database.close()


@pytest.fixture
async def repo(db):
    return ProjectRepository(db)


@pytest.fixture
async def page_repo(db):
    return PageRepository(db)


@pytest.fixture
async def version_repo(db):
    return VersionRepository(db)


class TestDatabase:
    @pytest.mark.asyncio
    async def test_connect_creates_tables(self, tmp_path):
        db = Database(db_path=tmp_path / "test2.db")
        await db.connect()
        # Verify tables exist
        for table in ["projects", "pages", "versions"]:
            cursor = await db.conn.execute(
                f"SELECT name FROM sqlite_master WHERE type='table' AND name='{table}'"
            )
            row = await cursor.fetchone()
            assert row is not None, f"Table {table} should exist"
        await db.close()


class TestProjectRepository:
    @pytest.mark.asyncio
    async def test_create_and_get(self, repo):
        project = Project(name="Test", description="Build it")
        await repo.create(project)

        loaded = await repo.get(project.id)
        assert loaded is not None
        assert loaded.name == "Test"
        assert loaded.description == "Build it"

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
        await repo.update(project)

        loaded = await repo.get(project.id)
        assert loaded.name == "After"

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


class TestPageRepository:
    @pytest.mark.asyncio
    async def test_create_and_get(self, repo, page_repo):
        project = Project(name="Test")
        await repo.create(project)

        page = Page(project_id=project.id, slug="home", title="Home")
        await page_repo.create(page)

        loaded = await page_repo.get(page.id)
        assert loaded is not None
        assert loaded.slug == "home"

    @pytest.mark.asyncio
    async def test_get_by_slug(self, repo, page_repo):
        project = Project(name="Test")
        await repo.create(project)

        page = Page(project_id=project.id, slug="about", title="About")
        await page_repo.create(page)

        loaded = await page_repo.get_by_slug(project.id, "about")
        assert loaded is not None
        assert loaded.title == "About"

    @pytest.mark.asyncio
    async def test_list_by_project(self, repo, page_repo):
        project = Project(name="Test")
        await repo.create(project)

        await page_repo.create(Page(project_id=project.id, slug="home", title="Home"))
        await page_repo.create(Page(project_id=project.id, slug="about", title="About"))

        pages = await page_repo.list_by_project(project.id)
        assert len(pages) == 2

    @pytest.mark.asyncio
    async def test_delete_by_slug(self, repo, page_repo):
        project = Project(name="Test")
        await repo.create(project)

        await page_repo.create(Page(project_id=project.id, slug="temp", title="Temp"))
        await page_repo.delete_by_slug(project.id, "temp")

        loaded = await page_repo.get_by_slug(project.id, "temp")
        assert loaded is None


class TestVersionRepository:
    @pytest.mark.asyncio
    async def test_create_and_get(self, repo, page_repo, version_repo):
        project = Project(name="Test")
        await repo.create(project)
        page = Page(project_id=project.id, slug="home", title="Home")
        await page_repo.create(page)

        version = PageVersion(page_id=page.id, version_number=1, prompt="Build home")
        await version_repo.create(version)

        loaded = await version_repo.get(version.id)
        assert loaded is not None
        assert loaded.version_number == 1

    @pytest.mark.asyncio
    async def test_next_version_number(self, repo, page_repo, version_repo):
        project = Project(name="Test")
        await repo.create(project)
        page = Page(project_id=project.id, slug="home", title="Home")
        await page_repo.create(page)

        next_num = await version_repo.next_version_number(page.id)
        assert next_num == 1

        await version_repo.create(PageVersion(page_id=page.id, version_number=1))
        next_num = await version_repo.next_version_number(page.id)
        assert next_num == 2

    @pytest.mark.asyncio
    async def test_get_latest(self, repo, page_repo, version_repo):
        project = Project(name="Test")
        await repo.create(project)
        page = Page(project_id=project.id, slug="home", title="Home")
        await page_repo.create(page)

        await version_repo.create(PageVersion(page_id=page.id, version_number=1, status="completed"))
        await version_repo.create(PageVersion(page_id=page.id, version_number=2, status="generating"))

        latest = await version_repo.get_latest(page.id)
        assert latest.version_number == 2

    @pytest.mark.asyncio
    async def test_update_version(self, repo, page_repo, version_repo):
        project = Project(name="Test")
        await repo.create(project)
        page = Page(project_id=project.id, slug="home", title="Home")
        await page_repo.create(page)

        version = PageVersion(page_id=page.id, version_number=1)
        await version_repo.create(version)

        version.status = "completed"
        version.usage = {"total_tokens": 500}
        await version_repo.update(version)

        loaded = await version_repo.get(version.id)
        assert loaded.status == "completed"
        assert loaded.usage["total_tokens"] == 500
