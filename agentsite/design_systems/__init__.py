"""Bundled design systems (Phase 9).

Each subdirectory contains a `DESIGN.md` (brand voice + posture) and a
`tokens.css` (CSS custom properties). Loaded via `discover_design_systems()`.
User-created systems live in the SQLite `design_systems` table (saved via
`POST /api/design-systems`).
"""

from __future__ import annotations

import logging
import re
from pathlib import Path
from typing import Iterable

logger = logging.getLogger("agentsite.design_systems")

DESIGN_SYSTEMS_DIR = Path(__file__).resolve().parent

_VAR_RE = re.compile(r"--([a-zA-Z0-9_-]+)\s*:\s*([^;]+);")


def _parse_tokens_css(text: str) -> dict[str, str]:
    """Return a flat {var_name: value} dict from a tokens.css :root block."""
    return {m.group(1): m.group(2).strip() for m in _VAR_RE.finditer(text)}


def discover_design_systems() -> list[dict]:
    """Return a list of {id, name, description, tokens, design_md} dicts."""
    systems: list[dict] = []
    for entry in sorted(DESIGN_SYSTEMS_DIR.iterdir()):
        if not entry.is_dir() or entry.name.startswith("_"):
            continue
        design_md = entry / "DESIGN.md"
        tokens_css = entry / "tokens.css"
        if not (design_md.exists() and tokens_css.exists()):
            continue
        try:
            md_text = design_md.read_text(encoding="utf-8")
            css_text = tokens_css.read_text(encoding="utf-8")
        except Exception:
            logger.warning("Failed to read design system %s", entry.name, exc_info=True)
            continue
        # Pull "# Name — Tagline" out of the first markdown header
        first_line = next((ln for ln in md_text.splitlines() if ln.strip()), "")
        name = first_line.lstrip("# ").strip() or entry.name
        systems.append({
            "id": entry.name,
            "name": name,
            "description": md_text,
            "tokens": _parse_tokens_css(css_text),
            "raw_css": css_text,
            "source": "bundled",
        })
    return systems


def find_design_system(system_id: str) -> dict | None:
    for s in discover_design_systems():
        if s["id"] == system_id:
            return s
    return None


def summary(system: dict) -> dict:
    """Compact form for /api/design-systems list."""
    return {
        "id": system["id"],
        "name": system["name"],
        "source": system.get("source", "bundled"),
        "palette_preview": _palette_preview(system["tokens"]),
    }


def _palette_preview(tokens: dict[str, str]) -> list[str]:
    """Return up to 6 swatch values from token slots that look like colors."""
    keys = ("bg", "surface", "fg", "muted", "border", "accent")
    out: list[str] = []
    for k in keys:
        v = tokens.get(k) or tokens.get(f"color-{k}")
        if v:
            out.append(v)
    return out


def list_summaries(extra: Iterable[dict] | None = None) -> list[dict]:
    bundled = [summary(s) for s in discover_design_systems()]
    if extra:
        bundled.extend(summary(s) for s in extra)
    return bundled
