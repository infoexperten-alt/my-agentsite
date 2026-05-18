"""Phase 3 — Pre-flight enforcement on write_file."""

from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace

from agentsite.agents.tools import read_guide, write_file


def _make_ctx(tmp_path: Path, *, required: set[str] | None = None) -> SimpleNamespace:
    project_dir = tmp_path / "proj"
    version_dir = project_dir / "v1"
    project_dir.mkdir(parents=True, exist_ok=True)
    version_dir.mkdir(parents=True, exist_ok=True)
    deps = {
        "project_dir": project_dir,
        "version_dir": version_dir,
        "assets_dir": tmp_path / "assets",
        "project_id": "p1",
        "written_files": [],
    }
    if required is not None:
        deps["_preflight_required"] = set(required)
        deps["_preflight_read"] = set()
    return SimpleNamespace(deps=deps)


def test_write_file_without_gate_works(tmp_path):
    ctx = _make_ctx(tmp_path)  # no _preflight_required
    out = write_file(ctx, "index.html", "<html></html>")
    assert out.startswith("Written:")
    assert (tmp_path / "proj" / "v1" / "index.html").read_text() == "<html></html>"


def test_write_file_blocked_when_required_unread(tmp_path):
    ctx = _make_ctx(tmp_path, required={"design-system.md", "architecture.md"})
    out = write_file(ctx, "index.html", "<html></html>")
    assert "PRE-FLIGHT REQUIRED" in out
    assert "design-system.md" in out
    assert "architecture.md" in out
    # File was NOT written
    assert not (tmp_path / "proj" / "v1" / "index.html").exists()


def test_read_guide_satisfies_gate_even_when_file_missing(tmp_path):
    ctx = _make_ctx(tmp_path, required={"design-system.md", "architecture.md"})
    # Guides don't exist on disk yet — but read_guide should still record the attempt
    a = read_guide(ctx, "design-system.md")
    b = read_guide(ctx, "architecture.md")
    assert "not found" in a.lower()
    assert "not found" in b.lower()
    # Now write_file should pass
    out = write_file(ctx, "index.html", "<html></html>")
    assert out.startswith("Written:")
    assert (tmp_path / "proj" / "v1" / "index.html").read_text() == "<html></html>"


def test_gate_disarms_after_first_satisfied_write(tmp_path):
    ctx = _make_ctx(tmp_path, required={"design-system.md"})
    read_guide(ctx, "design-system.md")
    write_file(ctx, "a.html", "a")
    # After disarm, further writes should not be gated
    assert "_preflight_required" not in ctx.deps
    out = write_file(ctx, "b.html", "b")
    assert out.startswith("Written:")


def test_read_guide_with_existing_file_returns_content(tmp_path):
    ctx = _make_ctx(tmp_path, required={"design-system.md"})
    guides = ctx.deps["project_dir"] / "guides"
    guides.mkdir()
    (guides / "design-system.md").write_text("primary: blue")
    out = read_guide(ctx, "design-system.md")
    assert out == "primary: blue"
    # Gate satisfied
    assert "design-system.md" in ctx.deps["_preflight_read"]


def test_partial_satisfaction_still_blocks(tmp_path):
    ctx = _make_ctx(tmp_path, required={"design-system.md", "architecture.md"})
    read_guide(ctx, "design-system.md")
    out = write_file(ctx, "index.html", "<html></html>")
    assert "PRE-FLIGHT REQUIRED" in out
    assert "architecture.md" in out
    assert "design-system.md" not in out.split("for each of: ")[1].split("]")[0]
