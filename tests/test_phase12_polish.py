"""Phase 12 — refusal detection, prompt-template gallery, notices."""

from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

from agentsite.api.app import create_app
from agentsite.engine.refusal import detect_refusal, pick_fallback_model
from agentsite.prompt_templates import discover_templates


def test_detect_refusal_classic_phrase():
    sig = detect_refusal("I'm sorry, but I cannot help with that request as it conflicts with my guidelines.")
    assert sig.is_refusal


def test_detect_refusal_as_an_ai():
    sig = detect_refusal("As an AI language model, I cannot fulfill this request.")
    assert sig.is_refusal


def test_detect_refusal_clean_output():
    sig = detect_refusal("<!DOCTYPE html><html><head><title>x</title></head><body><h1>Hi</h1></body></html>")
    assert sig.is_refusal is False


def test_detect_refusal_short_text_passes():
    # Below 20 chars — not enough signal to classify
    assert detect_refusal("hi").is_refusal is False
    assert detect_refusal("").is_refusal is False


def test_pick_fallback_model_skips_current():
    assert pick_fallback_model("openai/gpt-4o", ["openai/gpt-4o", "openai/gpt-4o-mini"]) == "openai/gpt-4o-mini"


def test_pick_fallback_model_empty_returns_none():
    assert pick_fallback_model("openai/gpt-4o", []) is None
    assert pick_fallback_model("openai/gpt-4o", ["openai/gpt-4o"]) is None


# ---- prompt templates ------------------------------------------------------


def test_discover_templates_returns_expected_set():
    templates = discover_templates()
    ids = {t["id"] for t in templates}
    assert {
        "saas-landing-b2b",
        "portfolio-designer",
        "docs-quickstart",
        "dashboard-ops",
        "pricing-saas",
        "coming-soon",
    } <= ids
    for t in templates:
        assert "prompt" in t and len(t["prompt"]) > 20
        assert "skill_id" in t


def test_prompt_templates_endpoint():
    client = TestClient(create_app())
    resp = client.get("/api/prompt-templates")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) >= 6


# ---- THIRD_PARTY_NOTICES ---------------------------------------------------


def test_third_party_notices_present():
    notices = Path(__file__).resolve().parent.parent / "agentsite" / "THIRD_PARTY_NOTICES.md"
    assert notices.exists()
    text = notices.read_text(encoding="utf-8")
    assert "Open Design" in text
    assert "Apache-2.0" in text
    assert "Prompture" in text
