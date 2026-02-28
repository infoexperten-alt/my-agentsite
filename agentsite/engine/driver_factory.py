"""Driver factory for per-project API key injection.

Thin wrapper around Prompture's ``get_async_driver_for_model``, adapted
from CachiBot's pattern. Allows each project to use its own provider
credentials without modifying global environment variables.
"""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger("agentsite.engine.driver_factory")


def build_driver_with_key(
    model_str: str,
    api_key: str | None = None,
    **extra: Any,
) -> Any:
    """Build an async Prompture driver, optionally injecting an explicit API key.

    Args:
        model_str: Full model string in ``provider/model_id`` format.
        api_key: Explicit API key. When ``None``, falls back to the global
            registry (environment variables).
        **extra: Additional kwargs forwarded to the driver constructor
            (e.g. ``endpoint`` for Azure/Ollama/LMStudio).

    Returns:
        An instantiated async driver ready for use with ``AsyncAgent(driver=...)``.
    """
    try:
        from prompture.drivers.async_registry import get_async_driver_for_model
    except ImportError:
        logger.warning("Prompture driver registry not available — cannot build custom driver")
        return None

    return get_async_driver_for_model(model_str, api_key=api_key, **extra)


def build_provider_environment(
    provider_keys: dict[str, str],
) -> Any | None:
    """Build a ProviderEnvironment from a dict of provider API keys.

    Args:
        provider_keys: Mapping of provider name to API key, e.g.
            ``{"openai": "sk-...", "claude": "sk-ant-..."}``.

    Returns:
        A ``ProviderEnvironment`` instance, or ``None`` if not available.
    """
    if not provider_keys:
        return None

    try:
        from prompture.infra.provider_env import ProviderEnvironment
    except ImportError:
        logger.debug("ProviderEnvironment not available in installed Prompture version")
        return None

    # Map provider names to ProviderEnvironment field names
    _PROVIDER_TO_FIELD = {
        "openai": "openai_api_key",
        "claude": "claude_api_key",
        "google": "google_api_key",
        "groq": "groq_api_key",
        "grok": "grok_api_key",
        "openrouter": "openrouter_api_key",
        "moonshot": "moonshot_api_key",
        "zai": "zhipu_api_key",
        "modelscope": "modelscope_api_key",
        "azure": "azure_api_key",
    }

    kwargs: dict[str, str] = {}
    for provider_name, api_key in provider_keys.items():
        field_name = _PROVIDER_TO_FIELD.get(provider_name)
        if field_name and api_key:
            kwargs[field_name] = api_key

    if not kwargs:
        return None

    try:
        return ProviderEnvironment(**kwargs)
    except Exception:
        logger.debug("Failed to create ProviderEnvironment", exc_info=True)
        return None


def resolve_driver_for_model(
    model_str: str,
    provider_keys: dict[str, str] | None = None,
) -> Any | None:
    """Resolve a driver for a model, using per-project keys if available.

    If ``provider_keys`` contains a key for the model's provider, builds
    a custom driver with that key injected. Otherwise returns ``None``
    (the agent will use the global driver from environment variables).

    Args:
        model_str: Full model string in ``provider/model_id`` format.
        provider_keys: Optional per-project provider credentials.

    Returns:
        An async driver instance, or ``None`` to use the global default.
    """
    if not provider_keys or "/" not in model_str:
        return None

    provider = model_str.split("/", 1)[0]
    api_key = provider_keys.get(provider)

    if not api_key:
        return None

    return build_driver_with_key(model_str, api_key=api_key)
