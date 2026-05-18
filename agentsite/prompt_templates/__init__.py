"""Phase 12 — prompt template gallery.

Each `web/*.json` is a starter prompt the user can click from the dashboard
to seed a new project. Curated subset; users can add more locally.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

logger = logging.getLogger("agentsite.prompt_templates")

TEMPLATES_DIR = Path(__file__).resolve().parent


def discover_templates() -> list[dict]:
    out: list[dict] = []
    for sub in ("web",):
        sub_dir = TEMPLATES_DIR / sub
        if not sub_dir.exists():
            continue
        for entry in sorted(sub_dir.glob("*.json")):
            try:
                data = json.loads(entry.read_text(encoding="utf-8"))
                data.setdefault("id", entry.stem)
                data.setdefault("category", sub)
                out.append(data)
            except Exception:
                logger.warning("Failed to load template %s", entry, exc_info=True)
    return out
