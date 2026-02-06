"""High-level generation pipeline wiring agents, callbacks, and storage."""

from __future__ import annotations

import json
import logging
import time
from collections.abc import Callable
from datetime import datetime, timezone
from typing import Any

from prompture import GroupCallbacks, GroupResult, SequentialGroup
from prompture.group_types import ErrorPolicy

from ..agents.orchestrator import _agent_model, create_dynamic_pipeline
from ..config import settings
from ..models import AgentConfig, AgentRun, PageOutput, Project, SitePlan, StyleSpec, WSEvent
from .gemini_patch import apply_gemini_patch
from .project_manager import ProjectManager
from .reasoning_patch import apply_reasoning_patch

logger = logging.getLogger("agentsite.pipeline")

# Apply patches at import time
apply_gemini_patch()
apply_reasoning_patch()


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


def _merge_nested_group_state(group: Any) -> None:
    """After a pipeline runs, merge nested group state back to the parent.

    The developer's ``page_output`` is stored in the LoopGroup's state
    but never propagated to the parent SequentialGroup.  This helper
    copies nested state back up so the pipeline can access it.

    Child state *always* overwrites parent state — the child ran later
    and holds the most up-to-date values for keys like ``page_output``
    and ``review_feedback``.
    """
    agents = getattr(group, "_agents", [])
    for item in agents:
        agent = item[0] if isinstance(item, tuple) else item
        if hasattr(agent, "shared_state") and hasattr(agent, "_agents"):
            # Recurse first
            _merge_nested_group_state(agent)
            # Merge child state into parent (child always wins)
            for k, v in agent.shared_state.items():
                group._state[k] = v


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
        self._developer_output_text: str = ""  # direct capture from callback
        self._developer_tool_calls: list[dict] = []  # tool calls from developer agent
        self._agent_models: dict[str, str] = {}  # agent_key -> resolved model name

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
            started_at = datetime.now(timezone.utc).isoformat()
            agent_model = self._agent_models.get(agent_key, "")
            self._emit("agent_start", agent=agent_key, data={"started_at": started_at, "model": agent_model})
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
            run = self._active_runs.pop(name, None)
            start_time = self._run_start_times.pop(name, None)
            duration_s = round(time.monotonic() - start_time, 1) if start_time else None

            output_text = getattr(result, "output_text", "") or ""
            tool_calls = getattr(result, "all_tool_calls", []) or []

            input_tokens = 0
            output_tokens = 0
            if run:
                run.status = "completed"
                run.completed_at = datetime.now(timezone.utc).isoformat()
                # Try multiple usage key formats (OpenAI vs Gemini vs Anthropic)
                usage = getattr(result, "usage", None) or getattr(result, "run_usage", None) or {}
                if isinstance(usage, dict):
                    input_tokens = (
                        usage.get("input_tokens", 0)
                        or usage.get("prompt_tokens", 0)
                        or usage.get("promptTokenCount", 0)
                    )
                    output_tokens = (
                        usage.get("output_tokens", 0)
                        or usage.get("completion_tokens", 0)
                        or usage.get("candidatesTokenCount", 0)
                    )
                    run.input_tokens = input_tokens
                    run.output_tokens = output_tokens
                    run.cost = float(
                        usage.get("cost", 0.0)
                        or usage.get("total_cost", 0.0)  # backwards compat
                        or 0.0
                    )

            # Capture developer output directly for fallback extraction
            if agent_key == "developer":
                self._developer_output_text = output_text
                self._developer_tool_calls = tool_calls
                logger.info(
                    "Developer agent completed: output_text length=%d, tool_calls=%d, output_text[:200]=%s",
                    len(output_text),
                    len(tool_calls),
                    repr(output_text[:200]),
                )
                if tool_calls:
                    for tc in tool_calls:
                        logger.info(
                            "  tool_call: %s(%s)",
                            tc.get("name", "?"),
                            ", ".join(f"{k}=...({len(str(v))})" for k, v in (tc.get("arguments") or {}).items()),
                        )

            # Extract reasoning/thinking from assistant messages.
            # The reasoning_patch ensures reasoning_content is present on
            # assistant messages for all code paths (not just native tool use).
            reasoning_text = ""
            result_messages = getattr(result, "messages", []) or []
            for msg in result_messages:
                if isinstance(msg, dict) and msg.get("role") == "assistant" and msg.get("reasoning_content"):
                    reasoning_text = msg["reasoning_content"]

            # When a reasoning model returns empty content (e.g. Kimi K2.5),
            # the driver uses reasoning_content as the text response.  Detect
            # this so we don't show reasoning twice (once as output, once as
            # thinking) and so the pipeline knows the real output was empty.
            if reasoning_text and output_text and output_text.strip() == reasoning_text.strip():
                logger.info(
                    "Agent %s output equals reasoning (%d chars) — actual content was empty",
                    agent_key,
                    len(reasoning_text),
                )
                output_text = ""

            if agent_key == "developer" and reasoning_text:
                self._developer_reasoning = reasoning_text

            agent_model = self._agent_models.get(agent_key, "")
            agent_cost = run.cost if run else 0.0
            self._emit(
                "agent_complete",
                agent=agent_key,
                data={
                    "output_preview": output_text[:2000],
                    "full_output": output_text,
                    "duration_s": duration_s,
                    "input_tokens": input_tokens,
                    "output_tokens": output_tokens,
                    "cost": agent_cost,
                    "tool_calls_count": len(tool_calls),
                    "model": agent_model,
                    "reasoning": reasoning_text,
                },
            )

        def _on_agent_error(name: str, exc: Exception) -> None:
            agent_key = _agent_name_to_key(name)
            # Emit as "agent_error" (non-fatal) rather than "error" (fatal).
            # The pipeline may retry this agent with a fallback, so we don't
            # want the frontend to disconnect the WebSocket prematurely.
            self._emit("agent_error", agent=agent_key, data={"message": str(exc)})
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
            # --- Resolve model for each agent and store for WS events ---
            from ..agents.pm import create_pm_agent

            for agent_key in ("pm", "designer", "developer", "reviewer"):
                self._agent_models[agent_key] = _agent_model(agent_key, model, self._agent_configs)

            # --- Phase A: Run PM agent standalone to get SitePlan ---
            pm_model = self._agent_models["pm"]
            pm_agent = create_pm_agent(pm_model)

            pm_callbacks = GroupCallbacks(
                on_agent_start=_on_agent_start,
                on_agent_complete=_on_agent_complete,
                on_agent_error=_on_agent_error,
            )
            pm_pipeline = SequentialGroup(
                [(pm_agent, "{prompt}")],
                callbacks=pm_callbacks,
                state={"prompt": page_prompt},
                error_policy=ErrorPolicy.raise_on_error,
            )
            _patch_pipeline_deps(pm_pipeline, deps)

            try:
                pm_result = pm_pipeline.run(page_prompt)
                site_plan_text = pm_result.shared_state.get("site_plan", "")
            except Exception as pm_exc:
                logger.warning(
                    "PM agent failed with structured output, retrying in plain text mode: %s",
                    pm_exc,
                )
                from ..agents.pm import create_pm_agent_plain

                pm_agent_plain = create_pm_agent_plain(pm_model)
                pm_pipeline_plain = SequentialGroup(
                    [(pm_agent_plain, "{prompt}")],
                    callbacks=pm_callbacks,
                    state={"prompt": page_prompt},
                    error_policy=ErrorPolicy.raise_on_error,
                )
                _patch_pipeline_deps(pm_pipeline_plain, deps)
                pm_result = pm_pipeline_plain.run(page_prompt)
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

            # --- Phase B: Run Designer standalone (with fallback) if needed ---
            initial_state = {
                "prompt": page_prompt,
                "site_plan": site_plan_text,
                "project_dir": self._pm.project_dir(project.id),
                "review_feedback": "",
                "logo_url": project.logo_url or "",
                "icon_url": project.icon_url or "",
                "page_slug": slug,
                "page_title": slug.replace("-", " ").title(),
            }

            if "designer" in required_agents:
                from prompture import clean_json_text

                from ..agents.designer import create_designer_agent, create_designer_agent_plain

                designer_model = self._agent_models["designer"]
                designer_agent = create_designer_agent(designer_model)
                designer_prompt = (
                    "Design a visual style for this website:\n\n"
                    f"Site Plan: {site_plan_text}\n\n"
                    f"Logo URL: {project.logo_url or ''}\n"
                    f"Icon URL: {project.icon_url or ''}\n\n"
                    "Create a cohesive color scheme, typography, and spacing system."
                )

                designer_callbacks = GroupCallbacks(
                    on_agent_start=_on_agent_start,
                    on_agent_complete=_on_agent_complete,
                    on_agent_error=_on_agent_error,
                )

                designer_pipeline = SequentialGroup(
                    [(designer_agent, "{designer_prompt}")],
                    callbacks=designer_callbacks,
                    state={"designer_prompt": designer_prompt},
                    error_policy=ErrorPolicy.raise_on_error,
                )
                _patch_pipeline_deps(designer_pipeline, deps)

                try:
                    designer_result = designer_pipeline.run(designer_prompt)
                    style_spec_text = designer_result.shared_state.get("style_spec", "")
                except Exception as designer_exc:
                    logger.warning(
                        "Designer agent failed with structured output, retrying in plain text mode: %s",
                        designer_exc,
                    )
                    designer_agent_plain = create_designer_agent_plain(designer_model)
                    designer_pipeline_plain = SequentialGroup(
                        [(designer_agent_plain, "{designer_prompt}")],
                        callbacks=designer_callbacks,
                        state={"designer_prompt": designer_prompt},
                        error_policy=ErrorPolicy.raise_on_error,
                    )
                    _patch_pipeline_deps(designer_pipeline_plain, deps)
                    designer_result = designer_pipeline_plain.run(designer_prompt)
                    style_spec_text = designer_result.shared_state.get("style_spec", "")

                initial_state["style_spec"] = style_spec_text

                # Merge designer usage into pm_result for later aggregation
                if hasattr(designer_result, "aggregate_usage"):
                    if not hasattr(pm_result, "aggregate_usage"):
                        pm_result.aggregate_usage = {}
                    for k, v in designer_result.aggregate_usage.items():
                        if isinstance(v, (int, float)):
                            pm_result.aggregate_usage[k] = pm_result.aggregate_usage.get(k, 0) + v

                # Remove designer from remaining pipeline since we ran it here
                remaining_agents = [a for a in required_agents if a != "designer"]
            else:
                remaining_agents = list(required_agents)
                # Use project's existing style_spec or sensible defaults
                if project.style_spec:
                    initial_state["style_spec"] = project.style_spec.model_dump_json()
                else:
                    initial_state["style_spec"] = StyleSpec().model_dump_json()

            # --- Phase C: Build dynamic pipeline for developer+reviewer ---
            remaining_pipeline = create_dynamic_pipeline(
                remaining_agents,
                model,
                callbacks=group_callbacks,
                agent_configs=self._agent_configs,
                error_policy=ErrorPolicy.raise_on_error,
            )

            # Transfer state from PM phase and propagate to nested groups
            # (LoopGroup) so prompt templates like {site_plan} resolve.
            remaining_pipeline.inject_state(initial_state, recursive=True)

            _patch_pipeline_deps(remaining_pipeline, deps)

            _need_dev_fallback = False
            try:
                result = remaining_pipeline.run("")
            except Exception as dev_exc:
                logger.warning(
                    "Developer pipeline failed (tools may be unsupported), will retry with plain text developer: %s",
                    dev_exc,
                )
                _need_dev_fallback = True
                # Create a minimal result to carry forward
                result = GroupResult(
                    agent_results=[],
                    aggregate_usage={},
                    shared_state=dict(initial_state),
                    elapsed_ms=0,
                    timeline=[],
                    errors=[],
                    success=False,
                )

            # Merge nested group state back so we can access page_output
            _merge_nested_group_state(remaining_pipeline)

            # Also fall back if the pipeline "succeeded" but developer
            # produced no usable output — either no tool calls and no files,
            # or the output text has no actual HTML code (just analysis/planning).
            if not _need_dev_fallback and not written_files and not self._developer_tool_calls:
                dev_text = self._developer_output_text or ""
                has_html = "<!DOCTYPE" in dev_text.upper() or "<html" in dev_text.lower()
                has_fenced = "```html" in dev_text or "```css" in dev_text
                if not has_html and not has_fenced:
                    logger.warning(
                        "Developer pipeline produced no usable code (success=%s, "
                        "written_files=%d, tool_calls=%d, has_html=%s, output_len=%d). "
                        "Retrying with plain text developer.",
                        result.success,
                        len(written_files),
                        len(self._developer_tool_calls),
                        has_html,
                        len(dev_text),
                    )
                    _need_dev_fallback = True

            if _need_dev_fallback:
                from ..agents.developer import create_developer_agent_plain

                dev_model = self._agent_models["developer"]
                dev_agent_plain = create_developer_agent_plain(dev_model)

                dev_prompt = (
                    f"Build the '{slug}' page ONLY. No other pages.\n\n"
                    f"Site Plan: {initial_state['site_plan']}\n\n"
                    f"Style Spec: {initial_state.get('style_spec', '')}\n\n"
                    f"Logo URL: {initial_state.get('logo_url', '')}\n"
                    f"Icon URL: {initial_state.get('icon_url', '')}\n\n"
                    "RESPOND WITH ONLY A ```html CODE BLOCK. "
                    "No planning, no analysis, no explanation. "
                    "Single self-contained HTML file with <style> and <script> inline. "
                    "Start your response with ```html immediately."
                )

                dev_callbacks = GroupCallbacks(
                    on_agent_start=_on_agent_start,
                    on_agent_complete=_on_agent_complete,
                    on_agent_error=_on_agent_error,
                )
                dev_pipeline_plain = SequentialGroup(
                    [(dev_agent_plain, "{dev_prompt}")],
                    callbacks=dev_callbacks,
                    state={"dev_prompt": dev_prompt},
                    error_policy=ErrorPolicy.raise_on_error,
                )
                _patch_pipeline_deps(dev_pipeline_plain, deps)
                plain_result = dev_pipeline_plain.run(dev_prompt)

                # Use the plain result's usage and state
                if hasattr(plain_result, "aggregate_usage"):
                    if not hasattr(result, "aggregate_usage"):
                        result.aggregate_usage = {}
                    for k, v in plain_result.aggregate_usage.items():
                        if isinstance(v, (int, float)):
                            result.aggregate_usage[k] = result.aggregate_usage.get(k, 0) + v
                result = plain_result

            # Merge usage from both phases
            combined_usage = pm_result.aggregate_usage.copy() if hasattr(pm_result, "aggregate_usage") else {}
            if hasattr(result, "aggregate_usage"):
                for k, v in result.aggregate_usage.items():
                    if isinstance(v, (int, float)):
                        combined_usage[k] = combined_usage.get(k, 0) + v

            # Extract structured outputs from shared state —
            # check both the result's shared_state and the pipeline's
            # own state (which now includes merged nested group state).
            state = result.shared_state
            page_output_text = (
                state.get("page_output", "")
                or remaining_pipeline.shared_state.get("page_output", "")
                or self._developer_output_text  # direct capture from callback
            )

            logger.info(
                "Post-pipeline state keys: result=%s, pipeline=%s, "
                "page_output_text length=%d, developer_output_text length=%d, "
                "written_files=%s",
                list(state.keys()),
                list(remaining_pipeline.shared_state.keys()),
                len(page_output_text or ""),
                len(self._developer_output_text),
                written_files,
            )

            # If the developer agent didn't write files via tools, try to
            # extract content from its raw output text as a fallback.
            if not written_files:
                logger.warning(
                    "No files written via tools for project %s page %s v%d. page_output_text[:500]: %s",
                    project.id,
                    slug,
                    version_number,
                    (page_output_text or "")[:500],
                )
                if page_output_text:
                    self._write_files_from_output(project.id, slug, version_number, page_output_text)

            # Verify files actually exist on disk
            final_files = self._pm.list_version_files(project.id, slug, version_number)

            # Fallback chain: try multiple strategies to get files on disk
            if not final_files and self._developer_tool_calls:
                logger.warning(
                    "No files on disk — trying extraction from %d tool_calls",
                    len(self._developer_tool_calls),
                )
                self._write_files_from_tool_calls(project.id, slug, version_number, self._developer_tool_calls)
                final_files = self._pm.list_version_files(project.id, slug, version_number)

            if not final_files:
                # Strategy 2: Extract from text output sources
                for source_name, source_text in [
                    ("page_output_text", page_output_text),
                    ("developer_output_text", self._developer_output_text),
                ]:
                    if source_text:
                        logger.warning(
                            "No files on disk — trying text fallback from %s (length=%d)",
                            source_name,
                            len(source_text),
                        )
                        self._write_files_from_output(project.id, slug, version_number, source_text)
                        final_files = self._pm.list_version_files(project.id, slug, version_number)
                        if final_files:
                            break

            if not final_files:
                logger.error(
                    "Generation produced no files for project %s page %s v%d. "
                    "tool_calls=%d, developer_output_text[:500]=%s",
                    project.id,
                    slug,
                    version_number,
                    len(self._developer_tool_calls),
                    self._developer_output_text[:500],
                )
                raise RuntimeError(
                    "Generation completed but no files were written to disk. "
                    "The developer agent may have returned output in an unexpected format.\n\n"
                    f"Developer output preview:\n{self._developer_output_text[:1000]}"
                )

            # Read files from disk into a dict for DB storage
            files_content: dict[str, str] = {}
            for fpath in final_files:
                content = self._pm.read_version_file(project.id, slug, version_number, fpath)
                if content is not None:
                    files_content[fpath] = content

            self._emit(
                "generation_complete",
                data={
                    "success": result.success,
                    "slug": slug,
                    "version": version_number,
                    "files": final_files,
                    "files_content": files_content,
                    "usage": combined_usage,
                },
            )

            # Return a result-like object with combined usage
            result.aggregate_usage = combined_usage
            return result

        except Exception as exc:
            import traceback

            logger.exception("Generation failed for project %s page %s v%d", project.id, slug, version_number)
            self._emit("error", data={"message": str(exc), "traceback": traceback.format_exc()})
            self._emit(
                "generation_complete",
                data={
                    "success": False,
                    "slug": slug,
                    "version": version_number,
                    "files": [],
                    "error": str(exc),
                },
            )
            raise

    def _write_files_from_tool_calls(self, project_id: str, slug: str, version: int, tool_calls: list[dict]) -> None:
        """Extract files from write_file tool call arguments and write them to disk."""
        for tc in tool_calls:
            name = tc.get("name", "")
            args = tc.get("arguments", {})
            if isinstance(args, str):
                try:
                    args = json.loads(args)
                except (json.JSONDecodeError, TypeError):
                    continue
            if name == "write_file" and "path" in args and "content" in args:
                path = args["path"]
                content = args["content"]
                try:
                    self._pm.write_version_file(project_id, slug, version, path, content)
                    logger.info("Wrote file from tool_call args: %s (%d bytes)", path, len(content))
                except Exception:
                    logger.warning("Failed to write file from tool_call: %s", path, exc_info=True)

    @staticmethod
    def _strip_reasoning_preamble(text: str) -> str:
        """Strip reasoning/thinking preamble from model output.

        Some models (e.g. Kimi K2.5) emit chain-of-thought reasoning before
        the actual code.  This helper removes everything before the first
        code fence or HTML tag so extraction can find the real content.
        """
        import re

        # If the text starts with a code fence, nothing to strip
        if text.lstrip().startswith("```"):
            return text

        # Try to find the first ```html or ```css or ```js fence
        fence_match = re.search(r"```(?:html|css|javascript|js)\b", text, re.IGNORECASE)
        if fence_match:
            stripped = text[fence_match.start() :]
            logger.info(
                "Stripped %d chars of reasoning preamble before code fence",
                fence_match.start(),
            )
            return stripped

        # Try to find raw HTML (<!DOCTYPE or <html)
        html_match = re.search(r"<!DOCTYPE\s+html|<html[\s>]", text, re.IGNORECASE)
        if html_match:
            stripped = text[html_match.start() :]
            logger.info(
                "Stripped %d chars of reasoning preamble before HTML",
                html_match.start(),
            )
            return stripped

        return text

    def _write_files_from_output(self, project_id: str, slug: str, version: int, output_text: str) -> None:
        """Parse PageOutput JSON from output text and write files."""
        try:
            from prompture import clean_json_text

            cleaned = clean_json_text(output_text)
            data = json.loads(cleaned)
            page_output = PageOutput.model_validate(data)
            for f in page_output.files:
                self._pm.write_version_file(project_id, slug, version, f.path, f.content)
                logger.info("Wrote file from output: %s", f.path)
        except Exception:
            logger.warning(
                "Could not parse PageOutput JSON, attempting fenced/raw extraction (length=%d)",
                len(output_text),
                exc_info=True,
            )
            # Strip reasoning/thinking preamble that some models emit
            cleaned_text = self._strip_reasoning_preamble(output_text)

            # Try extracting markdown-fenced code blocks first
            wrote_fenced = self._extract_fenced_blocks(project_id, slug, version, cleaned_text)
            if not wrote_fenced:
                # Last resort: if the output contains raw HTML, save it as index.html
                self._try_extract_raw_html(project_id, slug, version, cleaned_text)

    def _extract_fenced_blocks(self, project_id: str, slug: str, version: int, text: str) -> bool:
        """Extract markdown-fenced code blocks (```html, ```css, ```js) and write them.

        Returns True if at least one file was written.
        """
        import re

        # Match ```html ... ```, ```css ... ```, ```javascript/js ... ```
        pattern = r"```(\w+)\s*\n([\s\S]*?)```"
        matches = re.findall(pattern, text)
        if not matches:
            return False

        lang_to_file = {
            "html": "index.html",
            "css": "styles.css",
            "js": "script.js",
            "javascript": "script.js",
        }
        wrote_any = False
        # Track which filenames have been used to avoid overwriting
        used_names: set[str] = set()

        for lang, content in matches:
            lang_lower = lang.lower()
            filename = lang_to_file.get(lang_lower)
            if not filename:
                continue
            # If we already wrote this filename, append a suffix
            if filename in used_names:
                base, ext = filename.rsplit(".", 1)
                counter = 2
                while f"{base}_{counter}.{ext}" in used_names:
                    counter += 1
                filename = f"{base}_{counter}.{ext}"
            used_names.add(filename)
            self._pm.write_version_file(project_id, slug, version, filename, content.strip())
            logger.info("Extracted fenced %s block as %s (%d bytes)", lang_lower, filename, len(content))
            wrote_any = True

        return wrote_any

    def _try_extract_raw_html(self, project_id: str, slug: str, version: int, text: str) -> None:
        """Attempt to extract raw HTML from agent output as a last resort."""
        import re

        # Strip markdown code fences if wrapping the entire HTML
        stripped = re.sub(r"^```\w*\s*\n", "", text.strip())
        stripped = re.sub(r"\n```\s*$", "", stripped)

        # Look for HTML content (<!DOCTYPE or <html)
        html_match = re.search(
            r"(<!DOCTYPE html[\s\S]*?</html>|<html[\s\S]*?</html>)",
            stripped,
            re.IGNORECASE,
        )
        if html_match:
            html_content = html_match.group(1)
            self._pm.write_version_file(project_id, slug, version, "index.html", html_content)
            logger.info("Extracted raw HTML fallback as index.html (%d bytes)", len(html_content))

            # Also try to extract <style> blocks into styles.css
            style_blocks = re.findall(r"<style[^>]*>([\s\S]*?)</style>", html_content, re.IGNORECASE)
            if style_blocks:
                css_content = "\n\n".join(style_blocks)
                self._pm.write_version_file(project_id, slug, version, "styles.css", css_content)
                logger.info("Extracted CSS fallback as styles.css (%d bytes)", len(css_content))

            # Also try to extract <script> blocks into script.js
            script_blocks = re.findall(r"<script[^>]*>([\s\S]*?)</script>", html_content, re.IGNORECASE)
            # Filter out empty scripts and external src references
            script_blocks = [s.strip() for s in script_blocks if s.strip()]
            if script_blocks:
                js_content = "\n\n".join(script_blocks)
                self._pm.write_version_file(project_id, slug, version, "script.js", js_content)
                logger.info("Extracted JS fallback as script.js (%d bytes)", len(js_content))
        else:
            logger.error("No HTML content found in developer output (length=%d)", len(text))
