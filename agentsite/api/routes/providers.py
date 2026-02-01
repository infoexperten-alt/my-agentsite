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
    """Return all known providers with configuration status."""
    result = []
    for name, info in PROVIDERS.items():
        env_key = info["env_key"]
        value = os.environ.get(env_key, "")
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
