"""Phase 4 — Multi-dim critique + ratchet."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from agentsite.agents.critique import (
    parse_verdict,
    synthesize_verdict_from_dim_outputs,
)
from agentsite.api.app import create_app
from agentsite.engine import ratchet as ratchet_mod
from agentsite.engine.ratchet import evaluate, load_ratchet, update_ratchet
from agentsite.models import (
    CRITIQUE_DIMENSIONS,
    DimensionScore,
    QualityRatchet,
    ReviewVerdict,
)


@pytest.fixture(autouse=True)
def _isolate_ratchet_dir(tmp_path, monkeypatch):
    """Redirect ratchet I/O to a temp dir so tests don't touch ~/.agentsite."""
    def _path(project_id: str) -> Path:
        return tmp_path / project_id / "quality_ratchet.json"
    monkeypatch.setattr(ratchet_mod, "_ratchet_path", _path)
    return tmp_path


def _verdict(**dims) -> ReviewVerdict:
    scores = [DimensionScore(dimension=d, score=s) for d, s in dims.items()]
    overall = min(s for s in dims.values())
    return ReviewVerdict(scores=scores, overall_score=overall, approved=overall >= 7)


def test_dimension_constants_match_models():
    # The judge persona, ratchet, and reviewers all rely on this tuple.
    assert set(CRITIQUE_DIMENSIONS) == {
        "visual_fidelity",
        "accessibility",
        "content_quality",
        "code_health",
    }


def test_load_ratchet_missing_returns_zeros():
    r = load_ratchet("brand-new")
    assert r.project_id == "brand-new"
    assert r.floors == {d: 0 for d in CRITIQUE_DIMENSIONS}
    assert r.history == []


def test_evaluate_passes_when_floors_zero():
    floors = {d: 0 for d in CRITIQUE_DIMENSIONS}
    v = _verdict(visual_fidelity=4, accessibility=4, content_quality=4, code_health=4)
    accepted, regressed = evaluate(v, floors)
    assert accepted
    assert regressed == []


def test_evaluate_blocks_regression():
    floors = {"visual_fidelity": 8, "accessibility": 7, "content_quality": 6, "code_health": 7}
    v = _verdict(visual_fidelity=7, accessibility=7, content_quality=8, code_health=9)
    accepted, regressed = evaluate(v, floors)
    assert not accepted
    assert regressed == ["visual_fidelity"]


def test_update_ratchet_only_rises():
    pid = "p1"
    v1 = _verdict(visual_fidelity=6, accessibility=7, content_quality=8, code_health=9)
    r, accepted, _ = update_ratchet(pid, v1, slug="home", version=1)
    assert accepted
    assert r.floors["accessibility"] == 7
    assert r.floors["code_health"] == 9

    # Equal-to-floor still accepts but doesn't raise
    v2 = _verdict(visual_fidelity=6, accessibility=7, content_quality=8, code_health=9)
    r2, accepted2, _ = update_ratchet(pid, v2, slug="home", version=2)
    assert accepted2
    assert r2.floors == r.floors

    # Lower on one dim is rejected and floors stay
    v3 = _verdict(visual_fidelity=6, accessibility=5, content_quality=8, code_health=9)
    r3, accepted3, regressed3 = update_ratchet(pid, v3, slug="home", version=3)
    assert not accepted3
    assert regressed3 == ["accessibility"]
    assert r3.floors["accessibility"] == 7  # unchanged


def test_update_ratchet_persists_to_disk(_isolate_ratchet_dir):
    pid = "p2"
    v = _verdict(visual_fidelity=8, accessibility=8, content_quality=8, code_health=8)
    update_ratchet(pid, v, slug="home", version=1)
    path = _isolate_ratchet_dir / pid / "quality_ratchet.json"
    assert path.exists()
    data = json.loads(path.read_text())
    assert data["floors"]["accessibility"] == 8
    assert len(data["history"]) == 1


def test_ratchet_history_records_rejected_runs():
    pid = "p3"
    update_ratchet(pid, _verdict(visual_fidelity=8, accessibility=8, content_quality=8, code_health=8))
    update_ratchet(pid, _verdict(visual_fidelity=8, accessibility=2, content_quality=8, code_health=8))
    r = load_ratchet(pid)
    assert len(r.history) == 2
    assert r.history[0]["accepted"] is True
    assert r.history[1]["accepted"] is False
    assert r.history[1]["regressed"] == ["accessibility"]


def test_parse_verdict_clean_json():
    raw = json.dumps({
        "scores": [
            {"dimension": "visual_fidelity", "score": 8, "issues": [], "suggestions": []},
            {"dimension": "accessibility", "score": 7, "issues": [], "suggestions": []},
            {"dimension": "content_quality", "score": 9, "issues": [], "suggestions": []},
            {"dimension": "code_health", "score": 7, "issues": [], "suggestions": []},
        ],
        "overall_score": 7,
        "approved": True,
        "summary": "looks good",
    })
    v = parse_verdict(raw)
    assert v is not None
    assert v.overall_score == 7
    assert v.score_map()["visual_fidelity"] == 8


def test_parse_verdict_handles_markdown_fence():
    raw = "```json\n" + json.dumps({"scores": [], "overall_score": 5, "approved": False, "summary": ""}) + "\n```"
    v = parse_verdict(raw)
    assert v is not None


def test_parse_verdict_returns_none_on_garbage():
    assert parse_verdict("not json at all") is None
    assert parse_verdict("") is None


def test_synthesize_verdict_takes_minimum():
    outputs = [
        json.dumps({"dimension": "visual_fidelity", "score": 9, "issues": [], "suggestions": []}),
        json.dumps({"dimension": "accessibility", "score": 4, "issues": [], "suggestions": []}),
        json.dumps({"dimension": "content_quality", "score": 8, "issues": [], "suggestions": []}),
        "garbage",
    ]
    v = synthesize_verdict_from_dim_outputs(outputs)
    assert v.overall_score == 4  # min across parsed; garbage → 5
    assert v.approved is False
    assert len(v.scores) == 4


def test_quality_endpoint_returns_ratchet(_isolate_ratchet_dir, monkeypatch):
    # Use the TestClient as a context manager so the FastAPI lifespan runs
    # and the project repository is initialized.
    with TestClient(create_app()) as client:
        resp = client.post("/api/projects", json={"name": "QA project"})
        assert resp.status_code == 200
        pid = resp.json()["id"]
        resp2 = client.get(f"/api/projects/{pid}/quality")
        assert resp2.status_code == 200
        body = resp2.json()
        assert body["project_id"] == pid
        assert body["history"] == []


def test_quality_endpoint_404_for_unknown_project():
    with TestClient(create_app()) as client:
        resp = client.get("/api/projects/does-not-exist/quality")
        assert resp.status_code == 404
