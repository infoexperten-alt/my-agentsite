"""Phase 10 — per-project memory extraction & injection.

Memories are durable facts the user implicitly taught us in prior runs ("user
prefers serif headers", "brand voice is dry"). They are stored in the
`project_memories` table and prepended to PM / Developer prompts on the next
run so the user doesn't have to re-state them.

This module ships *heuristic* extraction — no LLM call, no extra cost.
Higher-fidelity extraction via `stepwise_extract_with_model` lands as a
follow-up once we want to spend tokens on it.
"""

from __future__ import annotations

import logging
import re
from typing import Iterable

from ..models import DiscoveryBrief, MemoryFact, ReviewVerdict

logger = logging.getLogger("agentsite.memory")


def render_for_context(memories: Iterable[MemoryFact]) -> str:
    """Render top memories into a compact markdown block for prompt injection."""
    items = list(memories)
    if not items:
        return ""
    lines = ["## Project memories (learned from prior runs)"]
    for m in items:
        prefix = {"preference": "Preference", "constraint": "Constraint",
                  "brand": "Brand", "other": "Note"}.get(m.kind, "Note")
        lines.append(f"- **{prefix}** ({m.confidence:.0%}): {m.body}")
    return "\n".join(lines)


# Heuristic extraction --------------------------------------------------------

_STEER_NEGATIVE = re.compile(
    r"(?:don[''’]?t|no|avoid|never|stop|less|fewer|hate|dislike)\b", re.IGNORECASE
)
_STEER_POSITIVE = re.compile(
    r"(?:more|want|prefer|use|like|love|always)\b", re.IGNORECASE
)


def _from_brief(brief: DiscoveryBrief, *, source_run_id: str = "") -> list[MemoryFact]:
    facts: list[MemoryFact] = []
    if brief.tone:
        facts.append(MemoryFact(
            kind="preference",
            body=f"Visual tone: {', '.join(brief.tone)}.",
            confidence=0.9,
            source_run_id=source_run_id,
        ))
    if brief.audience:
        facts.append(MemoryFact(
            kind="brand",
            body=f"Audience: {brief.audience}.",
            confidence=0.9,
            source_run_id=source_run_id,
        ))
    if brief.constraints:
        facts.append(MemoryFact(
            kind="constraint",
            body=f"Constraint: {brief.constraints}.",
            confidence=0.85,
            source_run_id=source_run_id,
        ))
    return facts


def _from_steer(steer_lines: Iterable[str], *, source_run_id: str = "") -> list[MemoryFact]:
    """Mid-flight steers tend to be the most actionable signal — capture each."""
    facts: list[MemoryFact] = []
    for raw in steer_lines:
        text = (raw or "").strip()
        if not text or len(text) < 4:
            continue
        # "- something" -> "something"
        text = re.sub(r"^[-*]\s+", "", text)
        # Classify as preference (positive) or constraint (negative)
        if _STEER_NEGATIVE.search(text):
            kind = "constraint"
        elif _STEER_POSITIVE.search(text):
            kind = "preference"
        else:
            kind = "other"
        body = text if text.lower().startswith("you ") else f"User said: \"{text[:200]}\"."
        facts.append(MemoryFact(
            kind=kind,
            body=body,
            confidence=0.7,
            source_run_id=source_run_id,
        ))
    return facts


def _from_verdict(verdict: ReviewVerdict | None, *, source_run_id: str = "") -> list[MemoryFact]:
    if verdict is None or not verdict.scores:
        return []
    weakest = min(verdict.scores, key=lambda d: d.score)
    if weakest.score >= 7:
        return []
    return [MemoryFact(
        kind="other",
        body=f"Weakest dimension last run: {weakest.dimension} ({weakest.score}/10).",
        confidence=0.6,
        source_run_id=source_run_id,
    )]


def extract_memories(
    *,
    project_id: str,
    brief: DiscoveryBrief | None = None,
    steer_lines: Iterable[str] | None = None,
    verdict: ReviewVerdict | None = None,
    source_run_id: str = "",
) -> list[MemoryFact]:
    """Combine all signal sources into a deduplicated list of MemoryFacts."""
    facts: list[MemoryFact] = []
    if brief is not None:
        facts.extend(_from_brief(brief, source_run_id=source_run_id))
    if steer_lines:
        facts.extend(_from_steer(steer_lines, source_run_id=source_run_id))
    facts.extend(_from_verdict(verdict, source_run_id=source_run_id))
    # Tag with project_id
    for f in facts:
        f.project_id = project_id
    # Dedupe on (kind, body)
    seen: set[tuple[str, str]] = set()
    out: list[MemoryFact] = []
    for f in facts:
        key = (f.kind, f.body)
        if key in seen:
            continue
        seen.add(key)
        out.append(f)
    return out
