"""FastAPI dependency injection."""

from __future__ import annotations

from ..engine.asset_handler import AssetHandler
from ..engine.project_manager import ProjectManager
from ..storage.database import Database
from ..storage.repository import ProjectRepository

# Singleton instances (initialized in app lifespan)
db = Database()
project_manager = ProjectManager()
asset_handler = AssetHandler(project_manager)
project_repo: ProjectRepository | None = None


async def get_db() -> Database:
    return db


async def get_repo() -> ProjectRepository:
    if project_repo is None:
        raise RuntimeError("Repository not initialized")
    return project_repo


async def get_pm() -> ProjectManager:
    return project_manager


async def get_assets() -> AssetHandler:
    return asset_handler
