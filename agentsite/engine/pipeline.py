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
from ..models import GeneratedFile, PageOutput, Project, ProjectStatus, SitePlan, StyleSpec, WSEvent
from .project_manager import ProjectManager

logger = logging.getLogger("agentsite.pipeline")


class GenerationPipeline:
    """Orchestrates the full site generation process.

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

    def generate(self, project: Project) -> GroupResult:
        """Run the full generation pipeline for a project.

        Args:
            project: Project with prompt and model set.

        Returns:
            GroupResult from the Prompture pipeline.
        """
        model = project.model or settings.default_model
        project_dir = self._pm.project_dir(project.id)
        site_dir = self._pm.site_dir(project.id)
        site_dir.mkdir(parents=True, exist_ok=True)

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

        # Inject project dir as dependency via shared state
        pipeline._state["prompt"] = project.prompt
        pipeline._state["project_dir"] = project_dir
        pipeline._state["review_feedback"] = ""

        # Inject deps for tools (they read from RunContext.deps)
        # The LoopGroup and inner agents get deps from their context
        # We set the state so prompts can be templated
        deps = {
            "project_dir": project_dir,
            "on_file_written": _on_file_written,
            "written_files": written_files,
        }

        self._emit("phase_start", data={"phase": "planning"})

        # Update project status
        project.status = ProjectStatus.generating
        self._pm.save_metadata(project)

        try:
            result = pipeline.run(project.prompt)

            # Extract structured outputs from shared state
            state = result.shared_state
            site_plan_text = state.get("site_plan", "")
            style_spec_text = state.get("style_spec", "")
            page_output_text = state.get("page_output", "")

            # Write files from the developer's PageOutput if tools weren't used
            if page_output_text and not written_files:
                self._write_files_from_output(project.id, page_output_text)

            # Update project metadata
            project.status = ProjectStatus.completed
            project.usage = result.aggregate_usage
            self._pm.save_metadata(project)

            self._emit("generation_complete", data={
                "success": result.success,
                "files": self._pm.list_site_files(project.id),
                "usage": result.aggregate_usage,
            })

            return result

        except Exception as exc:
            logger.exception("Generation failed for project %s", project.id)
            project.status = ProjectStatus.failed
            self._pm.save_metadata(project)
            self._emit("error", data={"message": str(exc)})
            raise

    def _write_files_from_output(self, project_id: str, output_text: str) -> None:
        """Parse PageOutput JSON from output text and write files."""
        try:
            from prompture import clean_json_text

            cleaned = clean_json_text(output_text)
            data = json.loads(cleaned)
            page_output = PageOutput.model_validate(data)
            for f in page_output.files:
                self._pm.write_site_file(project_id, f.path, f.content)
        except Exception:
            logger.debug("Could not parse PageOutput from text, files may have been written via tools")
