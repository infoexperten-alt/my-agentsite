"""Phase 6 — srcdoc live preview WS bridge."""

from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace

from agentsite.agents.tools import write_file


def _ctx(tmp_path: Path, on_preview=None):
    version_dir = tmp_path / "v"
    version_dir.mkdir(parents=True, exist_ok=True)
    deps = {
        "project_dir": tmp_path,
        "version_dir": version_dir,
        "written_files": [],
    }
    if on_preview is not None:
        deps["on_preview_update"] = on_preview
    return SimpleNamespace(deps=deps)


def test_write_file_fires_preview_for_html(tmp_path):
    seen = []
    ctx = _ctx(tmp_path, on_preview=lambda p, c: seen.append((p, c)))
    write_file(ctx, "index.html", "<!DOCTYPE html><h1>x</h1>")
    assert seen == [("index.html", "<!DOCTYPE html><h1>x</h1>")]


def test_write_file_does_not_fire_preview_for_css(tmp_path):
    seen = []
    ctx = _ctx(tmp_path, on_preview=lambda p, c: seen.append((p, c)))
    write_file(ctx, "styles.css", "body{color:red}")
    assert seen == []


def test_write_file_works_without_preview_callback(tmp_path):
    ctx = _ctx(tmp_path)  # no on_preview_update
    out = write_file(ctx, "index.html", "<!DOCTYPE html>")
    assert out.startswith("Written:")
    assert (tmp_path / "v" / "index.html").read_text().startswith("<!DOCTYPE html>")
