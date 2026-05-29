"""Phase 8 — brand extraction + SSRF guard."""

from __future__ import annotations

import pytest
from fastapi import HTTPException

from agentsite.agents.brand_extractor import (
    _classify_palette,
    _is_neutral,
    _normalize_hex,
    extract_from_text,
)
from agentsite.api.deps import guard_external_url


def test_normalize_hex_short_form():
    assert _normalize_hex("#fff") == "#ffffff"
    assert _normalize_hex("#abc") == "#aabbcc"


def test_normalize_hex_strips_alpha():
    assert _normalize_hex("#ff00ff80") == "#ff00ff"


def test_normalize_hex_rejects_bad():
    assert _normalize_hex("not-a-color") is None
    assert _normalize_hex("#abcde") is None  # 5 digits — invalid length


def test_is_neutral_detects_greyscale():
    assert _is_neutral("#ffffff") is True
    assert _is_neutral("#181818") is True
    assert _is_neutral("#2563eb") is False  # blue
    assert _is_neutral("#ff0000") is False


def test_classify_palette_picks_bg_and_accent():
    colors = ["#ffffff", "#ffffff", "#f8fafc", "#1f2937", "#1f2937", "#2563eb"]
    out = _classify_palette(colors)
    assert out["background_color"] == "#ffffff"
    assert out["text_color"] == "#1f2937"
    assert out["primary_color"] == "#2563eb"
    assert out["accent_color"] == "#2563eb"


def test_classify_palette_empty():
    assert _classify_palette([]) == {}


def test_extract_from_text_with_html_blob():
    html = """
    <html><head>
      <style>
        :root { --bg: #ffffff; --fg: #111111; --accent: #5046e4; }
        body { background: #f8fafc; color: #111111; font-family: Inter, sans-serif; }
        h1 { font-family: 'Space Grotesk'; }
        code { font-family: 'JetBrains Mono'; }
      </style>
    </head><body><h1>Hi</h1></body></html>
    """
    out = extract_from_text(html)
    assert out["background_color"] == "#ffffff"
    assert out["text_color"] == "#111111"
    assert "primary_color" in out  # one of the chromatic colors
    # First font sighted = body
    assert out["font_body"] in {"Inter", "Space Grotesk", "JetBrains Mono"}
    assert out.get("font_mono") == "JetBrains Mono"


# ---- guard_external_url ----------------------------------------------------


def test_guard_external_url_rejects_empty():
    with pytest.raises(HTTPException) as exc:
        guard_external_url("")
    assert exc.value.status_code == 400


def test_guard_external_url_rejects_file_scheme():
    with pytest.raises(HTTPException):
        guard_external_url("file:///etc/passwd")


def test_guard_external_url_rejects_javascript_scheme():
    with pytest.raises(HTTPException):
        guard_external_url("javascript:alert(1)")


def test_guard_external_url_rejects_loopback():
    with pytest.raises(HTTPException) as exc:
        guard_external_url("http://127.0.0.1/")
    assert "disallowed IP" in exc.value.detail


def test_guard_external_url_rejects_link_local():
    with pytest.raises(HTTPException):
        guard_external_url("http://169.254.169.254/latest/meta-data")


def test_guard_external_url_rejects_private_range():
    with pytest.raises(HTTPException):
        guard_external_url("http://10.0.0.1/")
    with pytest.raises(HTTPException):
        guard_external_url("http://192.168.1.1/")


def test_guard_external_url_rejects_missing_hostname():
    with pytest.raises(HTTPException):
        guard_external_url("https:///path")
