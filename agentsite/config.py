"""Configuration for AgentSite via Pydantic-settings."""

from __future__ import annotations

import os
from pathlib import Path

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """AgentSite application settings loaded from environment / .env."""

    model_config = {"env_prefix": "AGENTSITE_", "env_file": ".env", "extra": "ignore"}

    # Default LLM model for all agents
    default_model: str = "openai/gpt-4o"

    # Data directory for projects and database
    data_dir: Path = Path.home() / ".agentsite"

    # Server — also respect the plain PORT env var (used by Railway, Render, etc.)
    host: str = "0.0.0.0"
    port: int = int(os.environ.get("PORT", 6391))

    # Agent pipeline
    max_review_iterations: int = 2
    review_approval_threshold: int = 7

    @property
    def projects_dir(self) -> Path:
        return self.data_dir / "projects"

    @property
    def db_path(self) -> Path:
        return self.data_dir / "agentsite.db"

    def ensure_dirs(self) -> None:
        """Create required directories if they don't exist."""
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.projects_dir.mkdir(parents=True, exist_ok=True)


settings = Settings()
