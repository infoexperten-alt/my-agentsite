"""Configuration for AgentSite via Pydantic-settings."""

from __future__ import annotations

from pathlib import Path

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """AgentSite application settings loaded from environment / .env."""

    model_config = {"env_prefix": "AGENTSITE_", "env_file": ".env", "extra": "ignore"}

    # Default LLM model for all agents
    default_model: str = "openai/gpt-4o"

    # Data directory for projects and database
    data_dir: Path = Path.home() / ".agentsite"

    # Server
    host: str = "127.0.0.1"
    port: int = 6391

    # Agent pipeline
    max_review_iterations: int = 2
    review_approval_threshold: int = 7

    # Budget enforcement (0 = no limit)
    max_generation_cost: float = 0.0
    budget_policy: str = ""  # "hard_stop", "warn_and_continue", "degrade" (empty = disabled)
    budget_max_tokens: int = 0  # 0 = no limit
    budget_fallback_models: list[str] = []  # e.g. ["openai/gpt-4o-mini"]

    # Response caching
    cache_enabled: bool = False

    # Phase 3 — pre-flight enforcement on write_file (Developer must read
    # design-system.md and architecture.md first). Default on.
    preflight_enabled: bool = True
    preflight_required_guides: list[str] = ["design-system.md", "architecture.md"]

    # Phase 4 — multi-dimensional critique panel + ratchet. Default OFF for
    # one release; flip on once Phase 11 (smart routing) lands so the panel's
    # extra reviewer cost is offset.
    use_critique_panel: bool = False

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


def init_prompture() -> None:
    """Initialize Prompture global configuration (tracker + cache).

    Called once at app startup (CLI or server).
    """
    from prompture import configure_tracker

    configure_tracker(enabled=True, db_path=str(settings.data_dir / "usage.db"))

    if settings.cache_enabled:
        from prompture import configure_cache

        configure_cache(backend="sqlite", ttl=3600, db_path=str(settings.data_dir / "cache.db"))
