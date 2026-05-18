"""Phase 1 — Discovery form + DiscoveryBrief."""

from __future__ import annotations

from fastapi.testclient import TestClient

from agentsite.agents.discovery import (
    DISCOVERY_FORM_SCHEMA,
    brief_from_form,
    render_brief,
)
from agentsite.api.app import create_app
from agentsite.models import DiscoveryBrief


def test_discovery_brief_defaults_valid():
    brief = DiscoveryBrief()
    assert brief.brand_mode == "pick_direction"
    assert brief.platform == []
    assert brief.tone == []


def test_brief_from_form_full():
    answers = {
        "output": "web_prototype",
        "platform": ["responsive_web", "ios"],
        "audience": "indie founders",
        "tone": ["modern_minimal"],
        "brand": "brand_spec",  # legacy key from raw form
        "scale": "1 landing + 3 sub-pages",
        "constraints": "Use Inter; no emoji",
    }
    brief = brief_from_form(answers)
    assert brief.output == "web_prototype"
    assert brief.platform == ["responsive_web", "ios"]
    assert brief.brand_mode == "brand_spec"
    assert brief.constraints.startswith("Use Inter")


def test_brief_from_form_partial_uses_defaults():
    brief = brief_from_form({"output": "dashboard"})
    assert brief.output == "dashboard"
    assert brief.brand_mode == "pick_direction"
    assert brief.platform == []


def test_brief_from_form_handles_non_dict():
    brief = brief_from_form("garbage")
    assert isinstance(brief, DiscoveryBrief)


def test_brief_from_form_coerces_scalar_to_list():
    brief = brief_from_form({"platform": "ios", "tone": "modern_minimal"})
    assert brief.platform == ["ios"]
    assert brief.tone == ["modern_minimal"]


def test_render_brief_none_is_empty():
    assert render_brief(None) == ""


def test_render_brief_empty_brief_is_empty():
    # When every field is empty, the rendered block should be empty too
    assert render_brief(DiscoveryBrief(brand_mode="")) == ""


def test_render_brief_contains_expected_lines():
    brief = DiscoveryBrief(
        output="dashboard",
        platform=["responsive_web"],
        audience="ops team",
        brand_mode="pick_direction",
        direction_id="modern-minimal",
    )
    rendered = render_brief(brief)
    assert "## Discovery brief" in rendered
    assert "Surface:** dashboard" in rendered
    assert "Direction:** modern-minimal" in rendered


def test_discovery_form_schema_has_required_questions():
    qs = {q["id"] for q in DISCOVERY_FORM_SCHEMA["questions"]}
    # Stable IDs that downstream logic / OD branching relies on
    assert {"output", "platform", "audience", "tone", "brand", "scale", "constraints"} <= qs


def test_discovery_form_endpoint_returns_schema():
    client = TestClient(create_app())
    resp = client.get("/api/discovery/form")
    assert resp.status_code == 200
    body = resp.json()
    assert body["id"] == "discovery"
    assert any(q["id"] == "brand" for q in body["questions"])
