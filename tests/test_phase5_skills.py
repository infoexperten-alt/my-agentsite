"""Phase 5 — Skill catalog."""

from __future__ import annotations

from fastapi.testclient import TestClient

from agentsite.api.app import create_app
from agentsite.models import PagePlan
from agentsite.skills import discover_bundled_skills, find_skill, skill_summary

EXPECTED = {
    "saas-landing", "pricing-page", "dashboard", "docs-page",
    "blog-post", "portfolio", "mobile-app", "coming-soon",
}


def test_discover_loads_all_bundled_skills():
    skills = discover_bundled_skills()
    names = {s.name for s in skills}
    assert EXPECTED <= names
    assert len(skills) >= 8


def test_skill_has_frontmatter_metadata():
    s = find_skill("pricing-page")
    assert s is not None
    assert s.description
    assert s.metadata.get("mode") == "prototype"
    assert "pricing" in s.metadata.get("default_for", [])


def test_skill_instructions_have_required_sections_heading():
    for s in discover_bundled_skills():
        # Every SKILL.md body contains a Markdown H1 (the skill title)
        assert s.instructions.lstrip().startswith("#"), f"{s.name} missing title"


def test_find_skill_returns_none_for_unknown():
    assert find_skill("nope") is None


def test_skill_summary_shape():
    s = find_skill("dashboard")
    summary = skill_summary(s)
    assert summary["name"] == "dashboard"
    assert isinstance(summary["default_for"], list)
    assert "design_system_required" in summary


def test_as_persona_roundtrip():
    s = find_skill("saas-landing")
    persona = s.as_persona()
    # Skill name hyphens become underscores for valid Python identifiers
    assert persona.name == "saas_landing"
    assert persona.system_prompt == s.instructions


def test_skills_endpoint():
    client = TestClient(create_app())
    resp = client.get("/api/skills")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) >= 8
    assert {s["name"] for s in body} >= EXPECTED


def test_skill_detail_endpoint():
    client = TestClient(create_app())
    resp = client.get("/api/skills/dashboard")
    assert resp.status_code == 200
    body = resp.json()
    assert body["name"] == "dashboard"
    assert body["instructions"]  # full body included on detail


def test_skill_detail_404():
    client = TestClient(create_app())
    resp = client.get("/api/skills/not-real")
    assert resp.status_code == 404


def test_page_plan_skill_id_optional():
    p = PagePlan(slug="home", title="Home", sections=["hero"])
    assert p.skill_id is None
    p2 = PagePlan(slug="home", title="Home", sections=["hero"], skill_id="saas-landing")
    assert p2.skill_id == "saas-landing"
