"""High-level generation pipeline wiring agents, callbacks, and storage."""

from __future__ import annotations

import json
import logging
from collections.abc import Callable
from pathlib import Path
from typing import Any

from prompture import GroupCallbacks, GroupResult

from ..agents.orchestrator import create_pipeline
from ..config import settings
from ..models import GeneratedFile, PageOutput, Project, StyleSpec, WSEvent
from .project_manager import ProjectManager

logger = logging.getLogger("agentsite.pipeline")


def _patch_pipeline_deps(group: Any, deps: Any) -> None:
    """Monkey-patch every agent in a group so ``deps`` is always forwarded.

    ``SequentialGroup.run()`` and ``LoopGroup.run()`` call
    ``agent.run(prompt)`` without passing ``deps``, which means tools
    that rely on ``RunContext.deps`` receive ``None``.  This helper
    walks the group tree and wraps each agent's ``run`` method so that
    ``deps`` is injected automatically.
    """
    agents = getattr(group, "_agents", [])
    for item in agents:
        agent = item[0] if isinstance(item, tuple) else item
        # Recurse into nested groups (LoopGroup inside SequentialGroup)
        if hasattr(agent, "_agents"):
            _patch_pipeline_deps(agent, deps)
        else:
            _wrap_agent_run(agent, deps)


def _wrap_agent_run(agent: Any, deps: Any) -> None:
    original_run = agent.run

    def _patched_run(prompt: str, **kwargs: Any) -> Any:
        kwargs.setdefault("deps", deps)
        return original_run(prompt, **kwargs)

    agent.run = _patched_run


class GenerationPipeline:
    """Orchestrates the generation process for a single page version.

    Bridges the Prompture agent pipeline with the project filesystem
    and optional WebSocket event callbacks.
    """

    def __init__(
        self,
        project_manager: ProjectManager,
        *,
        on_event: Callable[[WSEvent], None] | None = None,
    ) -> None:
        self._pm = project_manager
        self._on_event = on_event

    def _emit(self, event_type: str, agent: str = "", **data: Any) -> None:
        """Fire a WebSocket event if a callback is registered."""
        if self._on_event:
            self._on_event(WSEvent(type=event_type, agent=agent, data=data))

    def generate(
        self,
        project: Project,
        *,
        slug: str,
        version_number: int,
        page_prompt: str,
    ) -> GroupResult:
        """Run the generation pipeline for a single page version.

        Args:
            project: The parent project.
            slug: Page slug (e.g. "home", "about").
            version_number: Version number to write to.
            page_prompt: The prompt describing what to build for this page.

        Returns:
            GroupResult from the Prompture pipeline.
        """
        model = project.model or settings.default_model

        # Ensure the version directory exists
        version_dir = self._pm.ensure_version_dir(project.id, slug, version_number)

        # Track written files for WS events
        written_files: list[str] = []

        def _on_file_written(path: str) -> None:
            written_files.append(path)
            self._emit("file_written", data={"path": path})

        # Build group callbacks that bridge to WS events
        group_callbacks = GroupCallbacks(
            on_agent_start=lambda name, prompt: self._emit("agent_start", agent=name),
            on_agent_complete=lambda name, result: self._emit(
                "agent_complete",
                agent=name,
                data={"output_preview": getattr(result, "output_text", "")[:500]},
            ),
            on_agent_error=lambda name, exc: self._emit(
                "error", agent=name, data={"message": str(exc)}
            ),
            on_state_update=lambda key, value: self._emit(
                "state_update", data={"key": key, "value_preview": str(value)[:200]}
            ),
        )

        # Create pipeline
        pipeline = create_pipeline(model, callbacks=group_callbacks)

        # Inject state — page-scoped prompt
        pipeline._state["prompt"] = page_prompt
        pipeline._state["project_dir"] = self._pm.project_dir(project.id)
        pipeline._state["review_feedback"] = ""

        # Inject deps for tools (they read from RunContext.deps)
        deps = {
            "project_dir": self._pm.project_dir(project.id),
            "version_dir": version_dir,
            "on_file_written": _on_file_written,
            "written_files": written_files,
        }

        # Patch all agents so deps is forwarded
        _patch_pipeline_deps(pipeline, deps)

        self._emit("phase_start", data={"phase": "planning", "slug": slug, "version": version_number})

        try:
            result = pipeline.run(page_prompt)

            # Extract structured outputs from shared state
            state = result.shared_state
            page_output_text = state.get("page_output", "")

            # Write files from the developer's PageOutput if tools weren't used
            if page_output_text and not written_files:
                self._write_files_from_output(project.id, slug, version_number, page_output_text)

            self._emit("generation_complete", data={
                "success": result.success,
                "slug": slug,
                "version": version_number,
                "files": self._pm.list_version_files(project.id, slug, version_number),
                "usage": result.aggregate_usage,
            })

            return result

        except Exception as exc:
            logger.exception("Generation failed for project %s page %s v%d", project.id, slug, version_number)
            self._emit("error", data={"message": str(exc)})
            self._emit("generation_complete", data={
                "success": False,
                "slug": slug,
                "version": version_number,
                "files": [],
                "error": str(exc),
            })
            raise

    def _write_files_from_output(
        self, project_id: str, slug: str, version: int, output_text: str
    ) -> None:
        """Parse PageOutput JSON from output text and write files."""
        try:
            from prompture import clean_json_text

            cleaned = clean_json_text(output_text)
            data = json.loads(cleaned)
            page_output = PageOutput.model_validate(data)
            for f in page_output.files:
                self._pm.write_version_file(project_id, slug, version, f.path, f.content)
        except Exception:
            logger.debug("Could not parse PageOutput from text, files may have been written via tools")
