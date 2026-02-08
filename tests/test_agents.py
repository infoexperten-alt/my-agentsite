"""Tests for AgentSite agent creation and personas."""

from prompture import AsyncAgent as Agent
from prompture import Persona

from agentsite.agents.designer import (
    create_designer_agent,
    create_designer_agent_auto,
    create_designer_agent_plain,
)
from agentsite.agents.developer import (
    create_developer_agent,
    create_developer_agent_auto,
    create_developer_agent_plain,
)
from agentsite.agents.personas import (
    DESIGNER_PERSONA,
    DEVELOPER_PERSONA,
    PM_PERSONA,
    REVIEWER_PERSONA,
)
from agentsite.agents.pm import create_pm_agent, create_pm_agent_auto, create_pm_agent_plain
from agentsite.agents.reviewer import (
    create_reviewer_agent,
    create_reviewer_agent_auto,
    create_reviewer_agent_plain,
)
from agentsite.engine.capabilities import (
    ModelCapabilities,
    get_capabilities,
    is_reasoning_model,
    supports_structured_output,
    supports_tools,
)
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


class TestCapabilities:
    def test_get_capabilities_returns_dataclass(self):
        caps = get_capabilities("openai/gpt-4o")
        assert isinstance(caps, ModelCapabilities)

    def test_gpt4o_has_full_support(self):
        caps = get_capabilities("openai/gpt-4o")
        assert caps.supports_tools is True
        assert caps.supports_structured_output is True

    def test_o1_preview_lacks_tools(self):
        caps = get_capabilities("openai/o1-preview")
        assert caps.supports_tools is False
        assert caps.is_reasoning is True

    def test_ollama_defaults_to_no_tools(self):
        caps = get_capabilities("ollama/llama3.1:8b")
        assert caps.supports_tools is False
        assert caps.supports_structured_output is False

    def test_helper_functions(self):
        assert supports_tools("openai/gpt-4o") is True
        assert supports_structured_output("openai/gpt-4o") is True
        assert is_reasoning_model("openai/o1-preview") is True
        assert is_reasoning_model("openai/gpt-4o") is False


class TestAutoFactories:
    def test_pm_auto_selects_structured_for_gpt4o(self):
        agent = create_pm_agent_auto("openai/gpt-4o")
        assert agent._output_type is SitePlan

    def test_pm_auto_selects_plain_for_ollama(self):
        agent = create_pm_agent_auto("ollama/llama3.1:8b")
        assert agent._output_type is None  # plain mode has no output_type

    def test_designer_auto_selects_structured_for_gpt4o(self):
        agent = create_designer_agent_auto("openai/gpt-4o")
        assert agent._output_type is StyleSpec

    def test_designer_auto_selects_plain_for_ollama(self):
        agent = create_designer_agent_auto("ollama/llama3.1:8b")
        assert agent._output_type is None

    def test_developer_auto_selects_tools_for_gpt4o(self):
        agent = create_developer_agent_auto("openai/gpt-4o")
        assert len(agent._tools.definitions) >= 3

    def test_developer_auto_selects_plain_for_ollama(self):
        agent = create_developer_agent_auto("ollama/llama3.1:8b")
        assert len(agent._tools.definitions) == 0  # plain mode has no tools

    def test_reviewer_auto_selects_full_for_gpt4o(self):
        agent = create_reviewer_agent_auto("openai/gpt-4o")
        assert agent._output_type is ReviewFeedback
        assert len(agent._tools.definitions) >= 1

    def test_reviewer_auto_selects_plain_for_ollama(self):
        agent = create_reviewer_agent_auto("ollama/llama3.1:8b")
        assert agent._output_type is None
        assert len(agent._tools.definitions) == 0


class TestPlainAgents:
    def test_pm_plain_has_json_in_prompt(self):
        agent = create_pm_agent_plain("openai/gpt-4o")
        assert "JSON" in agent._system_prompt

    def test_designer_plain_has_json_in_prompt(self):
        agent = create_designer_agent_plain("openai/gpt-4o")
        assert "JSON" in agent._system_prompt

    def test_developer_plain_has_no_tools(self):
        agent = create_developer_agent_plain("openai/gpt-4o")
        assert len(agent._tools.definitions) == 0
        assert "```html" in agent._system_prompt

    def test_reviewer_plain_has_no_tools(self):
        agent = create_reviewer_agent_plain("openai/gpt-4o")
        assert len(agent._tools.definitions) == 0
        assert "JSON" in agent._system_prompt
