"""FastAPI application factory for AgentSite."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from ..config import settings
from . import deps
from .routes import assets, generate, models, preview, projects
from .websocket import ws_manager

logger = logging.getLogger("agentsite.api")

_pkg_frontend = Path(__file__).resolve().parent.parent.parent / "frontend"
_cwd_frontend = Path.cwd() / "frontend"
FRONTEND_DIR = _pkg_frontend if _pkg_frontend.exists() else _cwd_frontend


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: connect DB on startup, close on shutdown."""
    settings.ensure_dirs()
    await deps.db.connect()
    deps.project_repo = deps.ProjectRepository(deps.db)
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

    # Serve frontend static files
    if FRONTEND_DIR.exists():
        app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")

    return app
