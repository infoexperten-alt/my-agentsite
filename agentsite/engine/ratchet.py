"""Per-project quality ratchet — read/update from disk.

The rule (Phase 4): a verdict is **accepted** only when every dimension score
is at least the current floor. When accepted, the floor for each dimension
rises to the new value (only-up). Floors never decrease.

The ratchet file lives at ``<project_dir>/quality_ratchet.json``. It is
treated as append-only history + a small current-state object; readers should
be tolerant of older shapes.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from pathlib import Path

from ..config import settings
from ..models import CRITIQUE_DIMENSIONS, QualityRatchet, ReviewVerdict

logger = logging.getLogger("agentsite.ratchet")


def _ratchet_path(project_id: str) -> Path:
    return settings.projects_dir / project_id / "quality_ratchet.json"


def load_ratchet(project_id: str) -> QualityRatchet:
    """Read the ratchet, returning an empty one when no file exists."""
    path = _ratchet_path(project_id)
    if not path.exists():
        return QualityRatchet(project_id=project_id, floors={d: 0 for d in CRITIQUE_DIMENSIONS})
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return QualityRatchet.model_validate(data)
    except Exception:
        logger.warning("Failed to parse quality_ratchet.json for %s — resetting", project_id, exc_info=True)
        return QualityRatchet(project_id=project_id, floors={d: 0 for d in CRITIQUE_DIMENSIONS})


def _save_ratchet(ratchet: QualityRatchet) -> None:
    path = _ratchet_path(ratchet.project_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(ratchet.model_dump_json(indent=2), encoding="utf-8")


def evaluate(verdict: ReviewVerdict, floors: dict[str, int]) -> tuple[bool, list[str]]:
    """Return (accepted, regressed_dimensions).

    Verdict is accepted when every dimension score equals or exceeds its floor.
    Missing floors default to 0 (always pass).
    """
    regressed: list[str] = []
    scores = verdict.score_map()
    for dim in CRITIQUE_DIMENSIONS:
        floor = floors.get(dim, 0)
        score = scores.get(dim, 0)
        if score < floor:
            regressed.append(dim)
    return (len(regressed) == 0, regressed)


def update_ratchet(
    project_id: str,
    verdict: ReviewVerdict,
    *,
    slug: str = "",
    version: int = 0,
) -> tuple[QualityRatchet, bool, list[str]]:
    """Evaluate ``verdict`` against the current floors and persist.

    Returns ``(ratchet, accepted, regressed_dimensions)``. When accepted,
    floors rise to ``max(existing, new_score)`` per dimension. History gets a
    new entry either way (audit trail).
    """
    ratchet = load_ratchet(project_id)
    ratchet.project_id = project_id  # in case the file was missing fields

    accepted, regressed = evaluate(verdict, ratchet.floors)

    raised: list[str] = []
    if accepted:
        for d in verdict.scores:
            current = ratchet.floors.get(d.dimension, 0)
            if d.score > current:
                ratchet.floors[d.dimension] = d.score
                raised.append(d.dimension)
        ratchet.last_verdict = verdict

    ratchet.history.append({
        "ts": datetime.now(timezone.utc).isoformat(),
        "slug": slug,
        "version": version,
        "scores": verdict.score_map(),
        "accepted": accepted,
        "regressed": regressed,
        "raised": raised,
    })

    _save_ratchet(ratchet)
    return ratchet, accepted, regressed
