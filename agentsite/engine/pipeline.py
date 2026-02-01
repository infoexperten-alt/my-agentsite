"""High-level generation pipeline wiring agents, callbacks, and storage."""

from __future__ import annotations

import json
import logging
import time
from collections.abc import Callable
from datetime import datetime, timezone
from typing import Any

from prompture import GroupCallbacks, GroupResult, SequentialGroup

from ..agents.orchestrator import create_dynamic_pipeline
from ..config import settings
from ..models import AgentConfig, AgentRun, PageOutput, Project, SitePlan, StyleSpec, WSEvent
from .project_manager import ProjectManager

logger = logging.getLogger("agentsite.pipeline")

def _agent_name_to_key(name: str) -> str:
    """Normalize agent name to short key (handles both persona and agent names)."""
    _NAME_MAP = {
        "agentsite_pm": "pm",
        "agentsite_designer": "designer",
        "agentsite_developer": "developer",
        "agentsite_reviewer": "reviewer",
    }
    return _NAME_MAP.get(name, name)


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
        agent_configs: dict[str, AgentConfig] | None = None,
    ) -> None:
        self._pm = project_manager
        self._on_event = on_event
        self._agent_configs = agent_configs
        self.agent_runs: list[AgentRun] = []
        self._active_runs: dict[str, AgentRun] = {}
        self._run_start_times: dict[str, float] = {}

    def _emit(self, event_type: str, agent: str = "", data: dict[str, Any] | None = None) -> None:
        """Fire a WebSocket event if a callback is registered."""
        if self._on_event:
            self._on_event(WSEvent(type=event_type, agent=agent, data=data or {}))

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

        def _on_agent_start(name: str, prompt: str) -> None:
            agent_key = _agent_name_to_key(name)
            self._emit("agent_start", agent=agent_key)
            run = AgentRun(
                project_id=project.id,
                page_slug=slug,
                version=version_number,
                agent_name=agent_key,
                status="running",
            )
            self._active_runs[name] = run
            self._run_start_times[name] = time.monotonic()
            self.agent_runs.append(run)

        def _on_agent_complete(name: str, result: Any) -> None:
            agent_key = _agent_name_to_key(name)
            self._emit(
                "agent_complete",
                agent=agent_key,
                data={"output_preview": getattr(result, "output_text", "")[:500]},
            )
            run = self._active_runs.pop(name, None)
            if run:
                run.status = "completed"
                run.completed_at = datetime.now(timezone.utc).isoformat()
                usage = getattr(result, "usage", None) or {}
                if isinstance(usage, dict):
                    run.input_tokens = usage.get("input_tokens", 0) or usage.get("prompt_tokens", 0)
                    run.output_tokens = usage.get("output_tokens", 0) or usage.get("completion_tokens", 0)

        def _on_agent_error(name: str, exc: Exception) -> None:
            agent_key = _agent_name_to_key(name)
            self._emit("error", agent=agent_key, data={"message": str(exc)})
            run = self._active_runs.pop(name, None)
            if run:
                run.status = "failed"
                run.completed_at = datetime.now(timezone.utc).isoformat()
                run.output_summary = {"error": str(exc)}

        # Build group callbacks that bridge to WS events
        group_callbacks = GroupCallbacks(
            on_agent_start=_on_agent_start,
            on_agent_complete=_on_agent_complete,
            on_agent_error=_on_agent_error,
            on_state_update=lambda key, value: self._emit(
                "state_update", data={"key": key, "value_preview": str(value)[:200]}
            ),
        )

        # Inject deps for tools (they read from RunContext.deps)
        deps = {
            "project_dir": self._pm.project_dir(project.id),
            "version_dir": version_dir,
            "on_file_written": _on_file_written,
            "written_files": written_files,
        }

        self._emit("phase_start", data={"phase": "planning", "slug": slug, "version": version_number})

        try:
            # --- Phase A: Run PM agent standalone to get SitePlan ---
            from ..agents.orchestrator import _agent_model
            from ..agents.pm import create_pm_agent

            pm_model = _agent_model("pm", model, self._agent_configs)
            pm_agent = create_pm_agent(pm_model)

            pm_callbacks = GroupCallbacks(
                on_agent_start=_on_agent_start,
                on_agent_complete=_on_agent_complete,
                on_agent_error=_on_agent_error,
            )
            pm_pipeline = SequentialGroup(
                [(pm_agent, "{prompt}")],
                callbacks=pm_callbacks,
            )
            pm_pipeline._state["prompt"] = page_prompt
            _patch_pipeline_deps(pm_pipeline, deps)

            pm_result = pm_pipeline.run(page_prompt)
            site_plan_text = pm_result.shared_state.get("site_plan", "")

            # Parse required_agents from the PM output
            required_agents = ["designer", "developer", "reviewer"]  # default
            try:
                from prompture import clean_json_text
                cleaned = clean_json_text(site_plan_text)
                plan_data = json.loads(cleaned)
                site_plan = SitePlan.model_validate(plan_data)
                required_agents = site_plan.required_agents
                # Ensure developer is always present
                if "developer" not in required_agents:
                    required_agents.append("developer")
            except Exception:
                logger.debug("Could not parse required_agents from PM output, using all agents")

            # Emit pipeline_plan event so frontend knows which agents will run
            all_agents = ["pm"] + [a for a in required_agents]
            self._emit("pipeline_plan", data={"required_agents": all_agents})

            # --- Phase B: Build dynamic pipeline for remaining agents ---
            # If designer is skipped, inject a default style_spec
            initial_state = {
                "prompt": page_prompt,
                "site_plan": site_plan_text,
                "project_dir": self._pm.project_dir(project.id),
                "review_feedback": "",
                "logo_url": project.logo_url or "",
                "icon_url": project.icon_url or "",
            }
            if "designer" not in required_agents:
                # Use project's existing style_spec or sensible defaults
                if project.style_spec:
                    initial_state["style_spec"] = project.style_spec.model_dump_json()
                else:
                    initial_state["style_spec"] = StyleSpec().model_dump_json()

            remaining_pipeline = create_dynamic_pipeline(
                required_agents,
                model,
                callbacks=group_callbacks,
                agent_configs=self._agent_configs,
            )

            # Transfer state from PM phase
            for k, v in initial_state.items():
                remaining_pipeline._state[k] = v

            _patch_pipeline_deps(remaining_pipeline, deps)

            result = remaining_pipeline.run("")

            # Merge usage from both phases
            combined_usage = pm_result.aggregate_usage.copy() if hasattr(pm_result, 'aggregate_usage') else {}
            if hasattr(result, 'aggregate_usage'):
                for k, v in result.aggregate_usage.items():
                    if isinstance(v, (int, float)):
                        combined_usage[k] = combined_usage.get(k, 0) + v

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
                "usage": combined_usage,
            })

            # Return a result-like object with combined usage
            result.aggregate_usage = combined_usage
            return result

        except Exception as exc:
            import traceback
            logger.exception("Generation failed for project %s page %s v%d", project.id, slug, version_number)
            self._emit("error", data={"message": str(exc), "traceback": traceback.format_exc()})
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
