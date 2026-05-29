"""Phase 11 — routing strategies + RAG retrieval."""

from __future__ import annotations

import pytest

from agentsite.config import settings
from agentsite.engine import rag_index
from agentsite.engine.model_resolver import route_for
from agentsite.models import AgentConfig


@pytest.fixture(autouse=True)
def _reset_index():
    rag_index.invalidate()
    yield
    rag_index.invalidate()


@pytest.fixture
def _snapshot_routing():
    orig_routing = dict(settings.agent_routing)
    orig_pools = {k: list(v) for k, v in settings.routing_model_pools.items()}
    yield
    settings.agent_routing.clear()
    settings.agent_routing.update(orig_routing)
    settings.routing_model_pools.clear()
    settings.routing_model_pools.update(orig_pools)


def test_route_for_explicit_config_wins(_snapshot_routing):
    settings.agent_routing["accessibility"] = "fast"
    settings.routing_model_pools["fast"] = ["openai/gpt-4o-mini"]
    cfg = {"accessibility": AgentConfig(agent_name="accessibility", model="openai/gpt-4o")}
    assert route_for("accessibility", "openai/gpt-4o", cfg) == "openai/gpt-4o"


def test_route_for_strategy_pool(_snapshot_routing):
    settings.agent_routing["accessibility"] = "fast"
    settings.routing_model_pools["fast"] = ["openai/gpt-4o-mini"]
    assert route_for("accessibility", "openai/gpt-4o", None) == "openai/gpt-4o-mini"


def test_route_for_explicit_hint(_snapshot_routing):
    settings.agent_routing["accessibility"] = "anthropic/claude-haiku-4-5-20251001"
    assert route_for("accessibility", "openai/gpt-4o", None) == "anthropic/claude-haiku-4-5-20251001"


def test_route_for_falls_back_to_default_when_pool_empty(_snapshot_routing):
    settings.agent_routing["accessibility"] = "quality_first"
    settings.routing_model_pools["quality_first"] = []
    assert route_for("accessibility", "openai/gpt-4o", None) == "openai/gpt-4o"


def test_route_for_unknown_agent_falls_through(_snapshot_routing):
    assert route_for("never-heard-of-it", "openai/gpt-4o", None) == "openai/gpt-4o"


# ---- RAG --------------------------------------------------------------------


def test_retrieve_empty_query():
    assert rag_index.retrieve("") == []


def test_retrieve_pricing_finds_pricing_skill():
    hits = rag_index.retrieve("3-tier pricing comparison page with feature table", k=3)
    ids = [h.entry.id for h in hits]
    assert "pricing-page" in ids
    # pricing-page should be the top hit (or very near it)
    assert hits[0].entry.id == "pricing-page"


def test_retrieve_dashboard_finds_dashboard_skill():
    hits = rag_index.retrieve("internal admin analytics dashboard for ops", k=3)
    assert hits and hits[0].entry.id == "dashboard"


def test_retrieve_kind_filter():
    hits = rag_index.retrieve("modern minimal precise", k=5, kinds=["design_system"])
    for h in hits:
        assert h.entry.kind == "design_system"


def test_retrieve_returns_at_most_k():
    hits = rag_index.retrieve("page", k=2)
    assert len(hits) <= 2


def test_invalidate_then_retrieve_still_works():
    rag_index.retrieve("pricing")
    rag_index.invalidate()
    assert rag_index.retrieve("pricing")  # re-builds
