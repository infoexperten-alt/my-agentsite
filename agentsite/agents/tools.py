"""Agent tools for filesystem operations and image analysis."""

from __future__ import annotations

import json
from pathlib import Path

from prompture import RunContext, ToolRegistry


def write_file(ctx: RunContext, path: str, content: str) -> str:
    """Write content to a file within the project version directory.

    Args:
        path: Relative file path within the version directory.
        content: Full file content to write.
    """
    version_dir: Path = ctx.deps["version_dir"]
    target = version_dir / path

    # Prevent path traversal
    try:
        target.resolve().relative_to(version_dir.resolve())
    except ValueError:
        return f"Error: path '{path}' escapes project directory"

    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")

    # Track written files
    written: list[str] = ctx.deps.setdefault("written_files", [])
    if path not in written:
        written.append(path)

    # Fire callback if available
    on_file_written = ctx.deps.get("on_file_written")
    if on_file_written:
        on_file_written(path)

    return f"Written: {path} ({len(content)} bytes)"


def read_file(ctx: RunContext, path: str) -> str:
    """Read a file from the project version directory.

    Args:
        path: Relative file path within the version directory.
    """
    version_dir: Path = ctx.deps["version_dir"]
    target = version_dir / path

    try:
        target.resolve().relative_to(version_dir.resolve())
    except ValueError:
        return f"Error: path '{path}' escapes project directory"

    if not target.exists():
        return f"Error: file '{path}' not found"

    return target.read_text(encoding="utf-8")


def list_files(ctx: RunContext) -> str:
    """List all files in the project version directory."""
    version_dir: Path = ctx.deps["version_dir"]

    if not version_dir.exists():
        return "No files generated yet."

    files = sorted(str(f.relative_to(version_dir)) for f in version_dir.rglob("*") if f.is_file())
    if not files:
        return "No files generated yet."

    return json.dumps(files, indent=2)


# ---------------------------------------------------------------------------
# Guide tools (project knowledge base)
# ---------------------------------------------------------------------------

_ALLOWED_GUIDE_FILENAMES = {
    "design-system.md",
    "style.json",
    "architecture.md",
    "component-guide.md",
    "site-plan.json",
}


def write_guide(ctx: RunContext, filename: str, content: str) -> str:
    """Write a guide file to the project knowledge base.

    Guides persist across generations so agents can build on prior knowledge.

    Args:
        filename: One of: design-system.md, style.json, architecture.md, component-guide.md
        content: Guide content to write.
    """
    if filename not in _ALLOWED_GUIDE_FILENAMES:
        return f"Error: filename must be one of {sorted(_ALLOWED_GUIDE_FILENAMES)}"

    project_dir: Path = ctx.deps["project_dir"]
    guides_dir = project_dir / "guides"
    guides_dir.mkdir(parents=True, exist_ok=True)
    target = guides_dir / filename

    # Prevent path traversal
    try:
        target.resolve().relative_to(guides_dir.resolve())
    except ValueError:
        return f"Error: path '{filename}' escapes guides directory"

    target.write_text(content, encoding="utf-8")
    return f"Guide written: {filename} ({len(content)} bytes)"


def read_guide(ctx: RunContext, filename: str) -> str:
    """Read a guide file from the project knowledge base.

    Args:
        filename: Guide filename to read.
    """
    project_dir: Path = ctx.deps["project_dir"]
    guides_dir = project_dir / "guides"
    target = guides_dir / filename

    try:
        target.resolve().relative_to(guides_dir.resolve())
    except ValueError:
        return f"Error: path '{filename}' escapes guides directory"

    if not target.exists():
        return f"Guide '{filename}' not found. Available guides: {list_guides(ctx)}"

    return target.read_text(encoding="utf-8")


def list_guides(ctx: RunContext) -> str:
    """List all guide files in the project knowledge base."""
    project_dir: Path = ctx.deps["project_dir"]
    guides_dir = project_dir / "guides"

    if not guides_dir.exists():
        return "No guides yet."

    files = sorted(f.name for f in guides_dir.iterdir() if f.is_file())
    if not files:
        return "No guides yet."

    return json.dumps(files, indent=2)


# ---------------------------------------------------------------------------
# Shared tool registries
# ---------------------------------------------------------------------------

registry = ToolRegistry()
registry.register(write_file)
registry.register(read_file)
registry.register(list_files)

# Designer: guide tools only (no file write/read for site files)
designer_tools = ToolRegistry()
designer_tools.register(write_guide)
designer_tools.register(read_guide)
designer_tools.register(list_guides)

# Developer: all file tools + guide tools
dev_tools = ToolRegistry()
dev_tools.register(write_file)
dev_tools.register(read_file)
dev_tools.register(list_files)
dev_tools.register(read_guide)
dev_tools.register(write_guide)
dev_tools.register(list_guides)

# Reviewer: read-only file tools + read-only guide tools
reviewer_tools = ToolRegistry()
reviewer_tools.register(read_file)
reviewer_tools.register(list_files)
reviewer_tools.register(read_guide)
reviewer_tools.register(list_guides)
