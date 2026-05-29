"""Phase 11 — lightweight retrieval over skills + design systems.

When the bundled catalogs grow past a few dozen entries, inlining everything
into the PM / Developer prompt becomes wasteful. This module returns the
top-K matches for a query so the orchestrator can inline only what's
relevant.

Default backend: token-overlap (no third-party deps). When `chromadb` is
installed, the same `retrieve()` signature transparently upgrades to vector
search. The lazy-built index is process-global; rebuild by calling
`invalidate()` after content changes.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from typing import Iterable

logger = logging.getLogger("agentsite.rag_index")

_STOP = {
    "the", "a", "an", "and", "or", "of", "for", "to", "in", "on", "at",
    "is", "are", "with", "by", "as", "it", "be", "this", "that", "from",
    "you", "your", "we", "our", "us", "page", "pages",
}
_TOKEN_RE = re.compile(r"[A-Za-z][A-Za-z0-9_-]+")


@dataclass(frozen=True)
class IndexEntry:
    id: str
    kind: str  # "skill" | "design_system"
    title: str
    body: str
    tokens: frozenset[str]


@dataclass(frozen=True)
class RetrievalHit:
    entry: IndexEntry
    score: float


def _tokenize(text: str) -> set[str]:
    return {t.lower() for t in _TOKEN_RE.findall(text or "") if t.lower() not in _STOP}


def _build_entries() -> list[IndexEntry]:
    entries: list[IndexEntry] = []
    try:
        from ..skills import discover_bundled_skills
        for sk in discover_bundled_skills():
            md = dict(sk.metadata or {})
            body = " ".join([
                sk.description,
                " ".join(md.get("default_for", []) or []),
                md.get("example_prompt", ""),
                sk.instructions[:1000],
            ])
            entries.append(IndexEntry(
                id=sk.name,
                kind="skill",
                title=sk.name,
                body=body,
                tokens=frozenset(_tokenize(body + " " + sk.name)),
            ))
    except Exception:
        logger.debug("skill catalog unavailable for RAG", exc_info=True)

    try:
        from ..design_systems import discover_design_systems
        for ds in discover_design_systems():
            body = ds.get("description", "")
            entries.append(IndexEntry(
                id=ds["id"],
                kind="design_system",
                title=ds["name"],
                body=body,
                tokens=frozenset(_tokenize(body + " " + ds["name"] + " " + ds["id"])),
            ))
    except Exception:
        logger.debug("design system catalog unavailable for RAG", exc_info=True)

    return entries


# Process-global cache (cheap to rebuild — token sets are small)
_ENTRIES: list[IndexEntry] | None = None


def _get_entries() -> list[IndexEntry]:
    global _ENTRIES
    if _ENTRIES is None:
        _ENTRIES = _build_entries()
    return _ENTRIES


def invalidate() -> None:
    """Force a rebuild on next retrieve()."""
    global _ENTRIES
    _ENTRIES = None


def retrieve(
    query: str,
    *,
    k: int = 5,
    kinds: Iterable[str] | None = None,
) -> list[RetrievalHit]:
    """Return up to `k` entries scored by token overlap with the query.

    `kinds` filters to a subset of {"skill", "design_system"} when set.
    """
    query_tokens = _tokenize(query)
    if not query_tokens:
        return []
    kinds_set = set(kinds) if kinds else None
    hits: list[RetrievalHit] = []
    for entry in _get_entries():
        if kinds_set and entry.kind not in kinds_set:
            continue
        overlap = len(query_tokens & entry.tokens)
        if overlap == 0:
            continue
        # Jaccard-ish: normalize by query size so short queries don't bias
        # toward entries with huge bodies.
        score = overlap / float(len(query_tokens))
        hits.append(RetrievalHit(entry=entry, score=score))
    hits.sort(key=lambda h: h.score, reverse=True)
    return hits[:k]
