"""Provider API key management endpoints."""

from __future__ import annotations

import logging
import os
import re
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

logger = logging.getLogger("agentsite.api.providers")
router = APIRouter(prefix="/api/providers", tags=["providers"])

PROVIDERS = {
    "openai": {"env_key": "OPENAI_API_KEY", "type": "api_key"},
    "claude": {"env_key": "CLAUDE_API_KEY", "type": "api_key"},
    "google": {"env_key": "GOOGLE_API_KEY", "type": "api_key"},
    "groq": {"env_key": "GROQ_API_KEY", "type": "api_key"},
    "grok": {"env_key": "GROK_API_KEY", "type": "api_key"},
    "openrouter": {"env_key": "OPENROUTER_API_KEY", "type": "api_key"},
    "moonshot": {"env_key": "MOONSHOT_API_KEY", "type": "api_key"},
    "zai": {"env_key": "ZHIPU_API_KEY", "type": "api_key"},
    "modelscope": {"env_key": "MODELSCOPE_API_KEY", "type": "api_key"},
    "azure": {
        "env_key": "AZURE_API_KEY",
        "type": "api_key",
        "extra_keys": ["AZURE_API_ENDPOINT", "AZURE_DEPLOYMENT_ID"],
    },
    "ollama": {
        "env_key": "OLLAMA_ENDPOINT",
        "type": "endpoint",
        "default": "http://localhost:11434/api/generate",
    },
    "lmstudio": {
        "env_key": "LMSTUDIO_ENDPOINT",
        "type": "endpoint",
        "default": "http://127.0.0.1:1234/v1/chat/completions",
    },
    "local_http": {
        "env_key": "LOCAL_HTTP_ENDPOINT",
        "type": "endpoint",
        "default": "http://localhost:8000/generate",
    },
}

ENV_PATH = Path.cwd() / ".env"


def _mask_value(value: str, provider_type: str) -> str:
    """Mask API keys (show last 4 chars), show full URL for endpoints."""
    if provider_type == "endpoint":
        return value
    if len(value) <= 4:
        return "****"
    return "*" * (len(value) - 4) + value[-4:]


def _read_env_file() -> str:
    """Read the .env file contents, return empty string if missing."""
    if ENV_PATH.exists():
        return ENV_PATH.read_text(encoding="utf-8")
    return ""


def _write_env_file(content: str) -> None:
    """Write content to the .env file."""
    ENV_PATH.write_text(content, encoding="utf-8")


def _set_env_value(key: str, value: str) -> None:
    """Set a key=value in the .env file, preserving comments and formatting."""
    content = _read_env_file()
    pattern = re.compile(rf"^#?\s*{re.escape(key)}\s*=.*$", re.MULTILINE)
    replacement = f"{key}={value}"

    if pattern.search(content):
        content = pattern.sub(replacement, content, count=1)
    else:
        if content and not content.endswith("\n"):
            content += "\n"
        content += f"{replacement}\n"

    _write_env_file(content)
    os.environ[key] = value


def _remove_env_value(key: str) -> None:
    """Comment out a key in the .env file and remove from os.environ."""
    content = _read_env_file()
    pattern = re.compile(rf"^{re.escape(key)}\s*=.*$", re.MULTILINE)
    content = pattern.sub(f"# {key}=", content)
    _write_env_file(content)
    os.environ.pop(key, None)


@router.get("")
async def list_providers():
    """Return all known providers with configuration status.

    Checks both os.environ and the .env file so that keys added before
    the server started are correctly shown as configured.
    """
    # Parse .env once so we can detect keys not yet in os.environ
    env_file_values: dict[str, str] = {}
    content = _read_env_file()
    for line in content.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" in line:
            k, _, v = line.partition("=")
            env_file_values[k.strip()] = v.strip()

    result = []
    for name, info in PROVIDERS.items():
        env_key = info["env_key"]
        # Prefer os.environ, fall back to .env file value
        value = os.environ.get(env_key, "") or env_file_values.get(env_key, "")
        # If found in .env but missing from os.environ, inject it
        if value and not os.environ.get(env_key):
            os.environ[env_key] = value
        configured = bool(value)
        masked = _mask_value(value, info["type"]) if configured else ""
        result.append(
            {
                "name": name,
                "env_key": env_key,
                "type": info["type"],
                "configured": configured,
                "masked_value": masked,
                "default": info.get("default", ""),
            }
        )
    return {"providers": result}


class ProviderUpdate(BaseModel):
    value: str


@router.put("/{name}")
async def update_provider(name: str, body: ProviderUpdate):
    """Set a provider's API key or endpoint."""
    if name not in PROVIDERS:
        raise HTTPException(status_code=404, detail=f"Unknown provider: {name}")

    info = PROVIDERS[name]
    _set_env_value(info["env_key"], body.value)

    # Trigger model re-discovery so new models appear immediately
    models = []
    try:
        from prompture import get_available_models

        models = get_available_models()
    except Exception as exc:
        logger.warning("Model re-discovery after provider update failed: %s", exc)

    return {"ok": True, "models": models}


@router.delete("/{name}")
async def delete_provider(name: str):
    """Remove a provider's API key or endpoint."""
    if name not in PROVIDERS:
        raise HTTPException(status_code=404, detail=f"Unknown provider: {name}")

    info = PROVIDERS[name]
    _remove_env_value(info["env_key"])
    return {"ok": True}
