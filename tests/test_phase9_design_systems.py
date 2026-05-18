"""Phase 9 — Design system library."""

from __future__ import annotations

from fastapi.testclient import TestClient

from agentsite.api.app import create_app
from agentsite.design_systems import (
    _parse_tokens_css,
    discover_design_systems,
    find_design_system,
)
from agentsite.models import StyleSpec

BUNDLED = {"linear", "vercel", "stripe", "notion"}


def test_discover_loads_bundled_systems():
    systems = discover_design_systems()
    ids = {s["id"] for s in systems}
    assert BUNDLED <= ids


def test_parse_tokens_css():
    css = ":root { --bg: #fff; --fg: #111; --accent: #5e6ad2; }"
    tokens = _parse_tokens_css(css)
    assert tokens == {"bg": "#fff", "fg": "#111", "accent": "#5e6ad2"}


def test_find_design_system_unknown():
    assert find_design_system("nope") is None


def test_each_bundled_has_required_tokens():
    required = {"bg", "surface", "fg", "muted", "border", "accent",
                "font-display", "font-body"}
    for s in discover_design_systems():
        missing = required - set(s["tokens"].keys())
        assert not missing, f"{s['id']} missing tokens: {missing}"


def test_stylespec_inherits_from_optional():
    spec = StyleSpec()
    assert spec.inherits_from is None
    spec2 = StyleSpec(inherits_from="linear")
    assert spec2.inherits_from == "linear"


def test_design_systems_list_endpoint():
    client = TestClient(create_app())
    resp = client.get("/api/design-systems")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) >= 4
    assert {s["id"] for s in body} >= BUNDLED


def test_design_system_detail_endpoint():
    client = TestClient(create_app())
    resp = client.get("/api/design-systems/linear")
    assert resp.status_code == 200
    body = resp.json()
    assert body["id"] == "linear"
    assert body["tokens"]["accent"] == "#5e6ad2"
    assert "raw_css" in body


def test_design_system_404():
    client = TestClient(create_app())
    resp = client.get("/api/design-systems/not-real")
    assert resp.status_code == 404


def test_save_user_system_roundtrip():
    client = TestClient(create_app())
    payload = {
        "id": "mybrand",
        "name": "My Brand",
        "tokens_css": ":root { --bg: #fafafa; --fg: #111; --accent: #ff00aa; }",
        "description": "User-saved test system",
    }
    resp = client.post("/api/design-systems", json=payload)
    assert resp.status_code == 200
    # It should show up in the list now
    resp2 = client.get("/api/design-systems")
    ids = {s["id"] for s in resp2.json()}
    assert "mybrand" in ids
    # And in detail
    resp3 = client.get("/api/design-systems/mybrand")
    assert resp3.status_code == 200
    assert resp3.json()["source"] == "user"


def test_save_user_system_validates():
    client = TestClient(create_app())
    resp = client.post("/api/design-systems", json={"id": "", "name": "x", "tokens_css": ""})
    assert resp.status_code == 400


def test_palette_preview_pulls_swatches():
    s = find_design_system("vercel")
    from agentsite.design_systems import summary
    out = summary(s)
    assert len(out["palette_preview"]) >= 4
    assert "#0070f3" in out["palette_preview"]
