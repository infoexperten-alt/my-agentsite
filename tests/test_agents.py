"""Tests for AgentSite agent creation and personas."""

from prompture import Agent, Persona

from agentsite.agents.designer import create_designer_agent
from agentsite.agents.developer import create_developer_agent
from agentsite.agents.personas import (
    DESIGNER_PERSONA,
    DEVELOPER_PERSONA,
    PM_PERSONA,
    REVIEWER_PERSONA,
)
from agentsite.agents.pm import create_pm_agent
from agentsite.agents.reviewer import create_reviewer_agent
from agentsite.models import PageOutputSummary, ReviewFeedback, SitePlan, StyleSpec


class TestPersonas:
    def test_pm_persona_is_persona(self):
        assert isinstance(PM_PERSONA, Persona)
        assert PM_PERSONA.name == "agentsite_pm"

    def test_designer_persona(self):
        assert isinstance(DESIGNER_PERSONA, Persona)
        assert "designer" in DESIGNER_PERSONA.name

    def test_developer_persona(self):
        assert isinstance(DEVELOPER_PERSONA, Persona)
        assert len(DEVELOPER_PERSONA.constraints) > 0

    def test_reviewer_persona(self):
        assert isinstance(REVIEWER_PERSONA, Persona)
        assert "QA" in REVIEWER_PERSONA.description or "review" in REVIEWER_PERSONA.description.lower()

    def test_personas_render(self):
        for persona in [PM_PERSONA, DESIGNER_PERSONA, DEVELOPER_PERSONA, REVIEWER_PERSONA]:
            rendered = persona.render()
            assert len(rendered) > 50
            assert "Constraints" in rendered


class TestAgentFactories:
    def test_create_pm_agent(self):
        agent = create_pm_agent("openai/gpt-4o")
        assert isinstance(agent, Agent)
        assert agent.name == "pm"
        assert agent.output_key == "site_plan"
        assert agent._output_type is SitePlan

    def test_create_designer_agent(self):
        agent = create_designer_agent("openai/gpt-4o")
        assert isinstance(agent, Agent)
        assert agent.name == "designer"
        assert agent._output_type is StyleSpec

    def test_create_developer_agent(self):
        agent = create_developer_agent("openai/gpt-4o")
        assert isinstance(agent, Agent)
        assert agent.name == "developer"
        assert agent._output_type is None  # no structured output — files written via tools
        # Has tools registered
        assert len(agent._tools.definitions) >= 3

    def test_create_reviewer_agent(self):
        agent = create_reviewer_agent("openai/gpt-4o")
        assert isinstance(agent, Agent)
        assert agent.name == "reviewer"
        assert agent._output_type is ReviewFeedback
        assert len(agent._tools.definitions) >= 1
