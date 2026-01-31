"""Agent tools for filesystem operations and image analysis."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from prompture import RunContext


def write_file(ctx: RunContext, path: str, content: str) -> str:
    """Write content to a file within the project directory.

    Args:
        path: Relative file path within the project site directory.
        content: Full file content to write.
    """
    project_dir: Path = ctx.deps["project_dir"]
    site_dir = project_dir / "site"
    target = site_dir / path

    # Prevent path traversal
    try:
        target.resolve().relative_to(site_dir.resolve())
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
    """Read a file from the project directory.

    Args:
        path: Relative file path within the project site directory.
    """
    project_dir: Path = ctx.deps["project_dir"]
    site_dir = project_dir / "site"
    target = site_dir / path

    try:
        target.resolve().relative_to(site_dir.resolve())
    except ValueError:
        return f"Error: path '{path}' escapes project directory"

    if not target.exists():
        return f"Error: file '{path}' not found"

    return target.read_text(encoding="utf-8")


def list_files(ctx: RunContext) -> str:
    """List all files in the project site directory."""
    project_dir: Path = ctx.deps["project_dir"]
    site_dir = project_dir / "site"

    if not site_dir.exists():
        return "No files generated yet."

    files = sorted(str(f.relative_to(site_dir)) for f in site_dir.rglob("*") if f.is_file())
    if not files:
        return "No files generated yet."

    return json.dumps(files, indent=2)
