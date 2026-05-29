"""Developer agent factory built on top of prompture.Assistant."""

from __future__ import annotations

from prompture import Assistant, AsyncAgent as Agent, Persona

from ..config import settings
from ..engine.capabilities import supports_tools
from .personas import DEVELOPER_PERSONA
from .tools import dev_tools

_DEV_PLAIN_PERSONA = Persona(
    name="agentsite_developer_plain",
    system_prompt=(
        "You write HTML code. No planning. No analysis. No explanation. Code only.\n\n"
        "OUTPUT EXACTLY ONE ```html block. Nothing else. No text before or after it.\n\n"
        "The HTML file must be SELF-CONTAINED with ALL CSS in <style> and ALL JS in <script>.\n\n"
        "```html\n"
        "<!DOCTYPE html>\n"
        '<html lang="en">\n'
        "<head>\n"
        '  <meta charset="UTF-8">\n'
        '  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n'
        "  <title>Page Title</title>\n"
        "  <style>/* ALL CSS HERE */</style>\n"
        "</head>\n"
        "<body>\n"
        "  <!-- ALL HTML CONTENT HERE -->\n"
        "  <script>/* ALL JS HERE */</script>\n"
        "</body>\n"
        "</html>\n"
        "```\n\n"
        "Requirements: semantic HTML5, CSS custom properties from StyleSpec, "
        "responsive mobile-first, Google Fonts CDN, accessible markup, "
        "vanilla HTML/CSS/JS only, picsum.photos for images, "
        "complete code with no placeholders or TODOs.\n\n"
        "CRITICAL: Your response must START with ```html — no other text allowed."
    ),
)

_DEV_OPTIONS = {"max_tokens": 65536, "timeout": 900}


def _developer_assistant(model: str) -> Assistant:
    """Tool-calling Developer Assistant (full LLM + write_file tools)."""
    return Assistant(
        name="developer",
        description="Generates HTML/CSS/JS files for each page",
        persona=DEVELOPER_PERSONA,
        tools=dev_tools,
        model=model,
        output_key="page_output",
        options=_DEV_OPTIONS,
    )


def _developer_deep_assistant(model: str) -> Assistant:
    """Planning-enabled Developer Assistant — wraps AsyncDeepAgent.

    VFS and summarisation are explicitly off because the developer
    writes to a real filesystem via the ``write_file`` tool — turning
    on VFS would shadow that and have the model write to an in-memory
    store the rest of the pipeline never reads.  Summarisation off
    avoids constructing a second driver, which matters for
    capability-check unit tests that pass synthetic model ids.
    """
    return Assistant(
        name="developer",
        description="Developer with planning (write_todos)",
        persona=DEVELOPER_PERSONA,
        tools=dev_tools,
        model=model,
        enable_planning=True,
        options=_DEV_OPTIONS,
        deep_agent_options={"enable_vfs": False, "enable_summarization": False},
    )


def _developer_plain_assistant(model: str) -> Assistant:
    """No-tools Developer Assistant for models without tool support."""
    return Assistant(
        name="developer",
        description="Generates HTML/CSS/JS files for each page (plain text mode)",
        persona=_DEV_PLAIN_PERSONA,
        model=model,
        output_key="page_output",
        options=_DEV_OPTIONS,
    )


def create_developer_agent_auto(model: str) -> Agent:
    """Create the Developer agent, automatically selecting tools or plain mode.

    Uses capability detection to choose the right variant upfront,
    avoiding runtime fallbacks.
    """
    if not supports_tools(model):
        return create_developer_agent_plain(model)
    if settings.use_deep_agent_developer:
        return create_developer_deep_agent(model)
    return create_developer_agent(model)


def create_developer_deep_agent(model: str) -> Agent:
    """Phase 7 — Developer wrapped in ``AsyncDeepAgent`` with planning on.

    Falls back to the regular tool-calling Developer when the installed
    Prompture predates ``AsyncDeepAgent`` (older site-packages installs).
    """
    try:
        from prompture.agents.async_deep_agent import AsyncDeepAgent  # noqa: F401
    except ImportError:
        import logging

        logging.getLogger("agentsite.developer").warning(
            "AsyncDeepAgent unavailable in installed prompture — "
            "falling back to tool-calling developer (no planning todos)."
        )
        return create_developer_agent(model)
    return _developer_deep_assistant(model).build_async_agent()


def create_developer_agent(model: str) -> Agent:
    """Create the standard tool-calling Developer agent."""
    return _developer_assistant(model).build_async_agent()


def create_developer_agent_plain(model: str) -> Agent:
    """Create the no-tools Developer for models without tool calling."""
    return _developer_plain_assistant(model).build_async_agent()
