"""Tests for AgentSite FastAPI endpoints."""

from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from agentsite.api import deps
from agentsite.api.app import create_app
from agentsite.engine.project_manager import ProjectManager
from agentsite.storage.database import Database
from agentsite.storage.repository import ProjectRepository


@pytest.fixture
async def client(tmp_path):
    """Create an async test client with initialized deps."""
    # Override deps with temp paths
    deps.db = Database(db_path=tmp_path / "test.db")
    deps.project_manager = ProjectManager(base_dir=tmp_path / "projects")
    deps.asset_handler = deps.AssetHandler(deps.project_manager)

    await deps.db.connect()
    deps.project_repo = ProjectRepository(deps.db)

    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    await deps.db.close()


class TestModelsEndpoint:
    @pytest.mark.asyncio
    async def test_list_models(self, client):
        resp = await client.get("/api/models")
        assert resp.status_code == 200
        data = resp.json()
        assert "models" in data
        assert isinstance(data["models"], list)


class TestProjectEndpoints:
    @pytest.mark.asyncio
    async def test_create_project(self, client):
        resp = await client.post(
            "/api/projects",
            json={"name": "Test", "prompt": "Build a portfolio"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "Test"
        assert "id" in data

    @pytest.mark.asyncio
    async def test_list_projects(self, client):
        await client.post("/api/projects", json={"name": "List Test"})
        resp = await client.get("/api/projects")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) >= 1

    @pytest.mark.asyncio
    async def test_get_project(self, client):
        create_resp = await client.post("/api/projects", json={"name": "Get Test"})
        project_id = create_resp.json()["id"]

        resp = await client.get(f"/api/projects/{project_id}")
        assert resp.status_code == 200
        assert resp.json()["id"] == project_id

    @pytest.mark.asyncio
    async def test_get_nonexistent_project(self, client):
        resp = await client.get("/api/projects/nonexistent123")
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_project(self, client):
        create_resp = await client.post("/api/projects", json={"name": "Delete Test"})
        project_id = create_resp.json()["id"]

        resp = await client.delete(f"/api/projects/{project_id}")
        assert resp.status_code == 200

        resp = await client.get(f"/api/projects/{project_id}")
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_list_files_empty(self, client):
        create_resp = await client.post("/api/projects", json={"name": "Files Test"})
        project_id = create_resp.json()["id"]

        resp = await client.get(f"/api/projects/{project_id}/files")
        assert resp.status_code == 200
        assert resp.json()["files"] == []

    @pytest.mark.asyncio
    async def test_generate_requires_prompt(self, client):
        create_resp = await client.post("/api/projects", json={"name": "Gen Test"})
        project_id = create_resp.json()["id"]

        resp = await client.post(f"/api/projects/{project_id}/generate", json={})
        assert resp.status_code == 400
