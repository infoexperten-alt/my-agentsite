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


def guard_external_url(url: str) -> str:
    """Phase 8 — SSRF guard for user-supplied URLs.

    Rejects:
      - non-http(s) schemes (file://, gopher://, javascript:, ...)
      - empty or malformed URLs
      - hostnames that resolve to a private/loopback/link-local IP

    Returns the normalized URL on success; raises HTTPException(400) otherwise.
    """
    import ipaddress
    import socket
    from urllib.parse import urlparse

    from fastapi import HTTPException

    if not url or not isinstance(url, str):
        raise HTTPException(status_code=400, detail="URL is required")
    parsed = urlparse(url.strip())
    if parsed.scheme not in ("http", "https"):
        raise HTTPException(status_code=400, detail="Only http(s) URLs are allowed")
    if not parsed.hostname:
        raise HTTPException(status_code=400, detail="URL missing hostname")

    try:
        infos = socket.getaddrinfo(parsed.hostname, None)
    except socket.gaierror as exc:
        raise HTTPException(status_code=400, detail=f"DNS resolution failed: {exc}") from exc

    for info in infos:
        try:
            ip = ipaddress.ip_address(info[4][0])
        except ValueError:
            continue
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_multicast or ip.is_reserved:
            raise HTTPException(
                status_code=400,
                detail=f"URL resolves to disallowed IP {ip} ({parsed.hostname})",
            )

    return parsed.geturl()


def reset():
    """Clear all singletons so they can be re-initialized."""
    global db, project_manager, asset_handler
    global project_repo, page_repo, version_repo
    global agent_config_repo, agent_run_repo, message_repo
    db = Database()
    project_manager = ProjectManager()
    asset_handler = AssetHandler(project_manager)
    project_repo = None
    page_repo = None
    version_repo = None
    agent_config_repo = None
    agent_run_repo = None
    message_repo = None
