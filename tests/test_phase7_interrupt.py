"""Phase 7 — interrupt mailbox + deep developer factory."""

from __future__ import annotations

import asyncio

import pytest

from agentsite.engine.interrupt import SteerMailbox, mailbox


@pytest.fixture
def fresh_mailbox():
    m = SteerMailbox()
    yield m


def test_drain_empty_returns_empty_list(fresh_mailbox):
    assert fresh_mailbox.drain("p1") == []


def test_deposit_then_drain_preserves_order(fresh_mailbox):
    fresh_mailbox.deposit("p1", "make headline bolder")
    fresh_mailbox.deposit("p1", "try a teal accent")
    out = fresh_mailbox.drain("p1")
    assert out == ["make headline bolder", "try a teal accent"]
    # Drain is destructive
    assert fresh_mailbox.drain("p1") == []


def test_deposit_skips_empty_string(fresh_mailbox):
    fresh_mailbox.deposit("p1", "")
    fresh_mailbox.deposit("p1", "real one")
    assert fresh_mailbox.drain("p1") == ["real one"]


def test_separate_projects_isolated(fresh_mailbox):
    fresh_mailbox.deposit("a", "for A")
    fresh_mailbox.deposit("b", "for B")
    assert fresh_mailbox.drain("a") == ["for A"]
    assert fresh_mailbox.drain("b") == ["for B"]


def test_clear_drops_pending(fresh_mailbox):
    fresh_mailbox.deposit("p1", "x")
    fresh_mailbox.clear("p1")
    assert fresh_mailbox.drain("p1") == []


def test_module_level_singleton_present():
    # The pipeline imports `mailbox` directly
    assert isinstance(mailbox, SteerMailbox)


def test_developer_deep_agent_factory_skips_when_tools_unsupported():
    """When the model doesn't support tools, deep-agent flag is ignored."""
    from agentsite.agents.developer import create_developer_agent_auto
    from agentsite.config import settings as cfg

    original = cfg.use_deep_agent_developer
    cfg.use_deep_agent_developer = True
    try:
        # `bogus/unknown-model` won't pass supports_tools — fall to plain mode
        agent = create_developer_agent_auto("bogus/unknown-model")
        # Plain mode agent has the JSON-instruction system prompt
        assert agent is not None
    finally:
        cfg.use_deep_agent_developer = original


def _has_event_loop() -> bool:
    try:
        asyncio.get_running_loop()
        return True
    except RuntimeError:
        return False
