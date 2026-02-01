"""FastAPI application factory for AgentSite."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from ..config import settings
from . import deps
from .routes import agents, assets, generate, models, preview, projects, providers
from .websocket import ws_manager

logger = logging.getLogger("agentsite.api")

# Prefer the built frontend (Vite output), fall back to source frontend dir
_pkg_frontend_dist = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
_cwd_frontend_dist = Path.cwd() / "frontend" / "dist"
_pkg_frontend = Path(__file__).resolve().parent.parent.parent / "frontend"
_cwd_frontend = Path.cwd() / "frontend"

if _pkg_frontend_dist.exists():
    FRONTEND_DIR = _pkg_frontend_dist
elif _cwd_frontend_dist.exists():
    FRONTEND_DIR = _cwd_frontend_dist
elif _pkg_frontend.exists():
    FRONTEND_DIR = _pkg_frontend
else:
    FRONTEND_DIR = _cwd_frontend


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: connect DB on startup, close on shutdown."""
    settings.ensure_dirs()
    await deps.db.connect()
    deps.project_repo = deps.ProjectRepository(deps.db)
    deps.page_repo = deps.PageRepository(deps.db)
    deps.version_repo = deps.VersionRepository(deps.db)
    deps.agent_config_repo = deps.AgentConfigRepository(deps.db)
    deps.agent_run_repo = deps.AgentRunRepository(deps.db)
    deps.message_repo = deps.MessageRepository(deps.db)
    logger.info("AgentSite started — data dir: %s", settings.data_dir)
    yield
    await deps.db.close()
    logger.info("AgentSite shutdown")


def create_app() -> FastAPI:
    """Build and configure the FastAPI application."""
    app = FastAPI(
        title="AgentSite",
        description="AI-Powered Website Builder using Prompture",
        version="0.1.0",
        lifespan=lifespan,
    )

    # CORS for local development
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # API routes
    app.include_router(projects.router)
    app.include_router(generate.router)
    app.include_router(models.router)
    app.include_router(assets.router)
    app.include_router(preview.router)
    app.include_router(providers.router)
    app.include_router(agents.router)

    # Serve frontend static files
    if FRONTEND_DIR.exists():
        app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="frontend-static")

        @app.get("/{full_path:path}")
        async def spa_fallback(full_path: str):
            """Serve static files or fall back to index.html for SPA routing."""
            if full_path.startswith(("api/", "ws/", "preview/")):
                raise HTTPException(status_code=404)

            # Try serving the exact file first
            file_path = FRONTEND_DIR / full_path
            if full_path and file_path.is_file():
                return FileResponse(file_path)

            # Fall back to index.html for client-side routing
            index = FRONTEND_DIR / "index.html"
            if index.exists():
                return FileResponse(index)

            raise HTTPException(status_code=404)

    return app
