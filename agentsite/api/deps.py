"""FastAPI dependency injection."""

from __future__ import annotations

from ..engine.asset_handler import AssetHandler
from ..engine.project_manager import ProjectManager
from ..storage.database import Database
from ..storage.repository import (
    AgentConfigRepository,
    AgentRunRepository,
    MessageRepository,
    PageRepository,
    ProjectRepository,
    VersionRepository,
)

# Singleton instances (initialized in app lifespan)
db = Database()
project_manager = ProjectManager()
asset_handler = AssetHandler(project_manager)
project_repo: ProjectRepository | None = None
page_repo: PageRepository | None = None
version_repo: VersionRepository | None = None
agent_config_repo: AgentConfigRepository | None = None
agent_run_repo: AgentRunRepository | None = None
message_repo: MessageRepository | None = None


async def get_db() -> Database:
    return db


async def get_repo() -> ProjectRepository:
    if project_repo is None:
        raise RuntimeError("Repository not initialized")
    return project_repo


async def get_page_repo() -> PageRepository:
    if page_repo is None:
        raise RuntimeError("Page repository not initialized")
    return page_repo


async def get_version_repo() -> VersionRepository:
    if version_repo is None:
        raise RuntimeError("Version repository not initialized")
    return version_repo


async def get_agent_config_repo() -> AgentConfigRepository:
    if agent_config_repo is None:
        raise RuntimeError("Agent config repository not initialized")
    return agent_config_repo


async def get_agent_run_repo() -> AgentRunRepository:
    if agent_run_repo is None:
        raise RuntimeError("Agent run repository not initialized")
    return agent_run_repo


async def get_message_repo() -> MessageRepository:
    if message_repo is None:
        raise RuntimeError("Message repository not initialized")
    return message_repo


async def get_pm() -> ProjectManager:
    return project_manager


async def get_assets() -> AssetHandler:
    return asset_handler
