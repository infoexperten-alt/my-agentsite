"""Developer agent factory."""

from __future__ import annotations

from prompture import Agent

from .personas import DEVELOPER_PERSONA
from .tools import list_files, read_file, write_file


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
        tools=[write_file, read_file, list_files],
        name="developer",
        description="Generates HTML/CSS/JS files for each page",
        output_key="page_output",
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
            "You are an expert frontend developer. You build complete, production-ready "
            "web pages using semantic HTML5, modern CSS, and vanilla JavaScript.\n\n"
            "WORKFLOW — you MUST follow this exact output format:\n"
            "Output each file using markdown fenced code blocks with the language tag.\n"
            "You MUST generate at least an index.html file.\n\n"
            "Example output format:\n"
            "```html\n"
            "<!DOCTYPE html>\n"
            "<html>...</html>\n"
            "```\n\n"
            "```css\n"
            "/* styles.css */\n"
            "body { ... }\n"
            "```\n\n"
            "```javascript\n"
            "// script.js\n"
            "document.addEventListener('DOMContentLoaded', ...);\n"
            "```\n\n"
            "Requirements:\n"
            "- Write clean, semantic HTML with proper heading hierarchy\n"
            "- Use CSS custom properties for theming (colors, fonts, spacing)\n"
            "- Make pages fully responsive (mobile-first approach)\n"
            "- Include smooth transitions and subtle animations\n"
            "- Add proper meta tags, viewport settings, and favicon links\n"
            "- Use Google Fonts via CDN link\n"
            "- Write accessible markup (ARIA labels, alt text, focus styles)\n\n"
            "Generate complete, self-contained files. Every HTML page should be fully functional "
            "when opened directly in a browser.\n\n"
            "IMPORTANT: Output ONLY the fenced code blocks with complete file contents. "
            "Do not include any other text or explanation."
        ),
        name="developer",
        description="Generates HTML/CSS/JS files for each page (plain text mode)",
        output_key="page_output",
    )
