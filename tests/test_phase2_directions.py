"""Phase 2 — Direction library."""

from __future__ import annotations

from fastapi.testclient import TestClient

from agentsite.agents.directions import (
    DESIGN_DIRECTIONS,
    find_direction,
    list_direction_summaries,
    synthesize_style_spec,
)
from agentsite.api.app import create_app
from agentsite.models import StyleSpec


def test_five_directions_present_with_expected_ids():
    ids = {d.id for d in DESIGN_DIRECTIONS}
    # Stable IDs ported verbatim from open-design's directions.ts
    assert ids == {
        "editorial-monocle",
        "modern-minimal",
        "human-approachable",
        "tech-utility",
        "brutalist-experimental",
    }


def test_palettes_are_oklch_strings():
    for d in DESIGN_DIRECTIONS:
        for k in ("bg", "surface", "fg", "muted", "border", "accent"):
            assert k in d.palette, f"{d.id} missing {k}"
            assert d.palette[k].startswith("oklch("), f"{d.id}.{k} not oklch"


def test_modern_minimal_palette_verbatim_from_open_design():
    # Source of truth — open-design/apps/daemon/src/prompts/directions.ts.
    d = find_direction("modern-minimal")
    assert d is not None
    assert d.palette["bg"] == "oklch(99% 0.002 240)"
    assert d.palette["accent"] == "oklch(58% 0.18 255)"


def test_find_direction_unknown_returns_none():
    assert find_direction("nonexistent") is None
    assert find_direction(None) is None
    assert find_direction("") is None


def test_synthesize_style_spec_is_deterministic():
    d = find_direction("editorial-monocle")
    spec_a = synthesize_style_spec(d)
    spec_b = synthesize_style_spec(d)
    assert isinstance(spec_a, StyleSpec)
    assert spec_a.model_dump() == spec_b.model_dump()
    assert spec_a.direction_id == "editorial-monocle"
    # OKLch parallel fields populated
    assert spec_a.bg_oklch == d.palette["bg"]
    assert spec_a.accent_oklch == d.palette["accent"]
    # Color slots populated from palette
    assert spec_a.background_color == d.palette["bg"]
    assert spec_a.text_color == d.palette["fg"]


def test_synthesize_uses_mono_font_when_present():
    d = find_direction("tech-utility")
    spec = synthesize_style_spec(d)
    assert spec.font_mono == d.mono_font


def test_synthesize_falls_back_to_default_mono_font():
    d = find_direction("modern-minimal")  # no mono_font
    assert d.mono_font is None
    spec = synthesize_style_spec(d)
    assert spec.font_mono  # non-empty default


def test_list_summaries_shape():
    summaries = list_direction_summaries()
    assert len(summaries) == 5
    s = summaries[0]
    for k in ("id", "label", "mood", "references", "display_font", "body_font", "palette", "posture"):
        assert k in s


def test_directions_endpoint():
    client = TestClient(create_app())
    resp = client.get("/api/directions")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 5
    assert {d["id"] for d in data} >= {"modern-minimal", "editorial-monocle"}


def test_direction_detail_endpoint_404():
    client = TestClient(create_app())
    resp = client.get("/api/directions/not-a-real-id")
    assert resp.status_code == 404


def test_direction_detail_endpoint_ok():
    client = TestClient(create_app())
    resp = client.get("/api/directions/modern-minimal")
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == "modern-minimal"


def test_stylespec_backwards_compatible():
    # Default StyleSpec still validates without the new fields
    spec = StyleSpec()
    assert spec.direction_id is None
    assert spec.bg_oklch is None
