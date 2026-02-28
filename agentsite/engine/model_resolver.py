"""Multi-layer model resolution for pipeline agents.

Uses Prompture's :class:`ModelResolver` with a layered fallback chain,
adapted from CachiBot's pattern. Layers (highest to lowest priority):

1. Per-request ``agent_models`` dict (from ``GenerateRequest``)
2. Per-agent ``AgentConfig`` overrides (from DB / project overrides)
3. Global ``settings.default_model``
"""

from __future__ import annotations

import logging

from ..config import settings
from ..models import AgentConfig

logger = logging.getLogger("agentsite.engine.model_resolver")

# Slot constants for different model roles
SLOT_DEFAULT = "default"
SLOT_UTILITY = "utility"  # cheap/fast model for background tasks (extraction, etc.)


def resolve_agent_model(
    agent_key: str,
    default_model: str,
    agent_configs: dict[str, AgentConfig] | None = None,
) -> str:
    """Resolve the model for an agent using layered fallback.

    Resolution order (via Prompture ModelResolver):
    1. Agent-specific override in ``agent_configs`` (if valid provider/model format)
    2. ``default_model`` (project or request level)
    3. ``settings.default_model`` (global fallback)

    Model strings must contain ``/`` to be considered valid.
    """
    try:
        from prompture.pipeline.resolver import (
            ModelResolver,
            dict_layer,
        )

        layers = []

        # Layer 1: Per-agent config override (highest priority)
        if agent_configs and agent_key in agent_configs:
            cfg = agent_configs[agent_key]
            if cfg.model and "/" in cfg.model:
                layers.append(dict_layer({SLOT_DEFAULT: cfg.model}))

        # Layer 2: Request/project-level default
        layers.append(dict_layer({SLOT_DEFAULT: default_model}))

        # Layer 3: Global settings (lowest priority)
        layers.append(dict_layer({SLOT_DEFAULT: settings.default_model}))

        resolver = ModelResolver(layers=layers)
        return resolver.resolve(SLOT_DEFAULT)
    except (ImportError, Exception) as exc:
        logger.debug("ModelResolver unavailable for %s: %s, using manual fallback", agent_key, exc)

    # Fallback: manual resolution (matches original _agent_model logic)
    if agent_configs and agent_key in agent_configs:
        cfg = agent_configs[agent_key]
        if cfg.model and "/" in cfg.model:
            return cfg.model
    return default_model


def resolve_utility_model(
    agent_configs: dict[str, AgentConfig] | None = None,
) -> str:
    """Resolve a cheap/fast model for background tasks like extraction.

    Uses the first available:
    1. Budget fallback models from settings
    2. Global default model
    """
    if settings.budget_fallback_models:
        return settings.budget_fallback_models[0]
    return settings.default_model
