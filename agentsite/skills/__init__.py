"""Bundled skills catalog (Phase 5).

Each subdirectory contains a `SKILL.md` with YAML frontmatter; the loader
returns Prompture `SkillInfo` instances via `prompture.discover_skills` /
`load_skill_from_directory` so the same API works for user-supplied skills.
"""

from __future__ import annotations

import logging
from pathlib import Path

logger = logging.getLogger("agentsite.skills")

SKILLS_DIR = Path(__file__).resolve().parent


def discover_bundled_skills():
    """Return every SkillInfo found under `agentsite/skills/<id>/SKILL.md`.

    Uses Prompture's `load_skill_from_directory` per skill so frontmatter
    parsing + resource path resolution match user skills exactly.
    """
    from prompture.agents.skills import SkillInfo, load_skill_from_directory

    skills: list[SkillInfo] = []
    for entry in sorted(SKILLS_DIR.iterdir()):
        if not entry.is_dir() or entry.name.startswith("_"):
            continue
        skill_file = entry / "SKILL.md"
        if not skill_file.exists():
            continue
        try:
            skills.append(load_skill_from_directory(entry, source="additional"))
        except Exception:
            logger.warning("Failed to load bundled skill from %s", entry, exc_info=True)
    return skills


def skill_summary(skill) -> dict:
    """Compact JSON for /api/skills."""
    md = dict(skill.metadata or {})
    return {
        "name": skill.name,
        "description": skill.description,
        "default_for": md.get("default_for", []),
        "mode": md.get("mode", ""),
        "platform": md.get("platform", ""),
        "scenario": md.get("scenario", ""),
        "example_prompt": md.get("example_prompt", ""),
        "design_system_required": md.get("design_system_required", False),
    }


def find_skill(name: str):
    """Find a bundled skill by name (None if absent)."""
    for s in discover_bundled_skills():
        if s.name == name:
            return s
    return None
