"""Phase 10 — memory extraction + repository + endpoint."""

from __future__ import annotations

from fastapi.testclient import TestClient

from agentsite.api.app import create_app
from agentsite.engine.memory import extract_memories, render_for_context
from agentsite.models import DimensionScore, DiscoveryBrief, MemoryFact, ReviewVerdict


def test_render_empty():
    assert render_for_context([]) == ""


def test_render_includes_facts():
    facts = [
        MemoryFact(project_id="p", kind="preference", body="You prefer serif headers.", confidence=0.9),
        MemoryFact(project_id="p", kind="constraint", body="No emoji in body copy.", confidence=0.8),
    ]
    rendered = render_for_context(facts)
    assert "Project memories" in rendered
    assert "Preference" in rendered
    assert "Constraint" in rendered
    assert "serif headers" in rendered


def test_extract_from_brief():
    brief = DiscoveryBrief(
        tone=["modern_minimal"],
        audience="indie founders",
        constraints="Use Inter, no emoji",
    )
    facts = extract_memories(project_id="p", brief=brief)
    kinds = {f.kind for f in facts}
    assert "preference" in kinds  # tone
    assert "brand" in kinds  # audience
    assert "constraint" in kinds  # constraints
    for f in facts:
        assert f.project_id == "p"


def test_extract_from_steer_classifies_negation_as_constraint():
    facts = extract_memories(project_id="p", steer_lines=["don't use orange"])
    assert facts[0].kind == "constraint"


def test_extract_from_steer_classifies_positive_as_preference():
    facts = extract_memories(project_id="p", steer_lines=["I prefer tabular numerics"])
    assert facts[0].kind == "preference"


def test_extract_from_verdict_skips_high_scores():
    v = ReviewVerdict(scores=[
        DimensionScore(dimension="visual_fidelity", score=9),
        DimensionScore(dimension="accessibility", score=8),
    ], overall_score=8, approved=True)
    facts = extract_memories(project_id="p", verdict=v)
    assert facts == []


def test_extract_from_verdict_captures_weakest_when_low():
    v = ReviewVerdict(scores=[
        DimensionScore(dimension="visual_fidelity", score=9),
        DimensionScore(dimension="content_quality", score=4),
    ], overall_score=4, approved=False)
    facts = extract_memories(project_id="p", verdict=v)
    assert len(facts) == 1
    assert "content_quality" in facts[0].body


def test_extract_dedupes():
    brief = DiscoveryBrief(constraints="No emoji")
    facts = extract_memories(project_id="p", brief=brief, steer_lines=[])
    # Run twice with the same input — dedupe within a single call
    assert len({(f.kind, f.body) for f in facts}) == len(facts)


def test_memory_endpoint_roundtrip():
    with TestClient(create_app()) as client:
        resp = client.post("/api/projects", json={"name": "Mem test"})
        pid = resp.json()["id"]

        # List empty
        r1 = client.get(f"/api/projects/{pid}/memories")
        assert r1.status_code == 200
        assert r1.json() == []

        # Add
        r2 = client.post(f"/api/projects/{pid}/memories", json={"body": "User likes serif", "kind": "preference"})
        assert r2.status_code == 200
        fact_id = r2.json()["id"]

        # List has it
        r3 = client.get(f"/api/projects/{pid}/memories")
        assert len(r3.json()) == 1

        # Delete
        r4 = client.delete(f"/api/projects/{pid}/memories/{fact_id}")
        assert r4.status_code == 200
        r5 = client.get(f"/api/projects/{pid}/memories")
        assert r5.json() == []


def test_memory_endpoint_404_for_unknown_project():
    with TestClient(create_app()) as client:
        r = client.get("/api/projects/nope/memories")
        assert r.status_code == 404
