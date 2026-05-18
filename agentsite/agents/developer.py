"""Developer agent factory."""

from __future__ import annotations

from prompture import AsyncAgent as Agent

from ..config import settings
from ..engine.capabilities import supports_tools
from .personas import DEVELOPER_PERSONA
from .tools import dev_tools


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
    """Phase 7 — Developer wrapped in `AsyncDeepAgent` with planning on.

    Gives us `write_todos` for free (live plan list streamed via the pipeline's
    todo_update event). VFS, sub-agents, and summarization are explicitly OFF
    because the developer writes to a real filesystem via our existing
    `write_file` tool — turning on VFS would shadow that and cause the model
    to write to an in-memory store the rest of the pipeline never reads.

    Falls back to the regular tool-calling Developer when the installed
    Prompture predates `AsyncDeepAgent` (older site-packages installs).
    """
    try:
        from prompture.agents.async_deep_agent import AsyncDeepAgent
    except ImportError:
        import logging
        logging.getLogger("agentsite.developer").warning(
            "AsyncDeepAgent unavailable in installed prompture — "
            "falling back to tool-calling developer (no planning todos)."
        )
        return create_developer_agent(model)

    return AsyncDeepAgent(
        model,
        system_prompt=DEVELOPER_PERSONA,
        tools=dev_tools,
        enable_planning=True,
        enable_vfs=False,
        enable_summarization=False,
        name="developer",
        description="Developer with planning (write_todos)",
        options={"max_tokens": 65536, "timeout": 900},
    )


def create_developer_agent(model: str) -> Agent:
    """Create the Developer agent that generates page files.

    Note: No ``output_type`` is set because the developer writes files
    via the ``write_file`` tool.  Forcing structured-output parsing on the
    final text response causes failures when the LLM returns empty text
    after finishing its tool calls.  The pipeline already handles file
    extraction from both tool-written files and raw output text.
    """
    return Agent(
        model,
        system_prompt=DEVELOPER_PERSONA,
        tools=dev_tools,
        name="developer",
        description="Generates HTML/CSS/JS files for each page",
        output_key="page_output",
        options={"max_tokens": 65536, "timeout": 900},
    )


def create_developer_agent_plain(model: str) -> Agent:
    """Create a Developer agent WITHOUT tools for models that don't support tool calling.

    Instead of using write_file/read_file tools, this agent outputs file contents
    directly in its response using markdown fenced code blocks. The pipeline's
    existing fallback extraction logic (_extract_fenced_blocks, _try_extract_raw_html)
    handles parsing the output into files on disk.
    """
    return Agent(
        model,
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
        name="developer",
        description="Generates HTML/CSS/JS files for each page (plain text mode)",
        output_key="page_output",
        options={"max_tokens": 65536, "timeout": 900},
    )
