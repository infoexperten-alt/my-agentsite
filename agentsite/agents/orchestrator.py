"""Pipeline orchestration using Prompture groups."""

from __future__ import annotations

from typing import Any

from prompture import GroupCallbacks, LoopGroup, SequentialGroup

from ..config import settings
from ..models import AgentConfig
from .designer import create_designer_agent
from .developer import create_developer_agent
from .pm import create_pm_agent
from .reviewer import create_reviewer_agent


def create_pipeline(
    model: str | None = None,
    *,
    callbacks: GroupCallbacks | None = None,
    max_review_iterations: int | None = None,
    review_threshold: int | None = None,
    agent_configs: dict[str, AgentConfig] | None = None,
) -> SequentialGroup:
    """Build the full generation pipeline (static — all 4 agents).

    Pipeline structure::

        SequentialGroup([
            PM Agent         -> site_plan
            Designer Agent   -> style_spec
            LoopGroup([      (per build+review cycle)
                Developer    -> page_output
                Reviewer     -> review_feedback
            ])
        ])

    Args:
        model: Model string (provider/model). Defaults to settings.
        callbacks: Group-level observability callbacks.
        max_review_iterations: Max dev+review cycles. Defaults to settings.
        review_threshold: Min review score to approve. Defaults to settings.
        agent_configs: Per-agent config overrides from DB.
    """
    effective_model = model or settings.default_model
    max_iters = max_review_iterations or settings.max_review_iterations
    threshold = review_threshold or settings.review_approval_threshold

    pm = create_pm_agent(_agent_model("pm", effective_model, agent_configs))
    designer = create_designer_agent(_agent_model("designer", effective_model, agent_configs))
    developer = create_developer_agent(_agent_model("developer", effective_model, agent_configs))
    reviewer = create_reviewer_agent(_agent_model("reviewer", effective_model, agent_configs))

    # Build+Review loop: exit when approved or max iterations reached
    def _exit_condition(state: dict[str, Any], iteration: int) -> bool:
        feedback_text = state.get("review_feedback", "")
        if not feedback_text:
            return False
        lower = feedback_text.lower()
        return '"approved": true' in lower or '"approved":true' in lower

    build_review_loop = LoopGroup(
        [
            (
                developer,
                "Build the website page based on this plan:\n\n"
                "Site Plan: {site_plan}\n\n"
                "Style Spec: {style_spec}\n\n"
                "Logo URL: {logo_url}\n"
                "Icon URL: {icon_url}\n\n"
                "Previous review feedback (if any): {review_feedback}\n\n"
                "Use the write_file tool to save each file. Generate complete, "
                "self-contained HTML with inline or linked CSS/JS.",
            ),
            (
                reviewer,
                "Review the generated website code.\n\n"
                "Site Plan: {site_plan}\n"
                "Style Spec: {style_spec}\n"
                "Developer output: {page_output}\n\n"
                "IMPORTANT: First call the list_files tool to discover what files were generated, "
                "then use read_file to inspect each one. "
                f"Approve if quality score >= {threshold}.",
            ),
        ],
        exit_condition=_exit_condition,
        max_iterations=max_iters,
        callbacks=callbacks,
    )

    # Full pipeline
    pipeline = SequentialGroup(
        [
            (pm, "{prompt}"),
            (
                designer,
                "Design a visual style for this website:\n\n"
                "Site Plan: {site_plan}\n\n"
                "Logo URL: {logo_url}\n"
                "Icon URL: {icon_url}\n\n"
                "Create a cohesive color scheme, typography, and spacing system.",
            ),
            build_review_loop,
        ],
        callbacks=callbacks,
    )

    return pipeline


def create_dynamic_pipeline(
    required_agents: list[str],
    model: str | None = None,
    *,
    callbacks: GroupCallbacks | None = None,
    max_review_iterations: int | None = None,
    review_threshold: int | None = None,
    agent_configs: dict[str, AgentConfig] | None = None,
) -> SequentialGroup:
    """Build a dynamic pipeline based on PM's required_agents output.

    PM always runs before this. This builds the remaining pipeline steps
    based on which agents the PM decided are needed.

    Args:
        required_agents: List of agent keys from SitePlan.required_agents.
        model: Default model string.
        callbacks: Group-level observability callbacks.
        max_review_iterations: Max dev+review cycles.
        review_threshold: Min review score.
        agent_configs: Per-agent config overrides from DB.
    """
    effective_model = model or settings.default_model
    max_iters = max_review_iterations or settings.max_review_iterations
    threshold = review_threshold or settings.review_approval_threshold

    steps: list[Any] = []

    # Designer (optional)
    if "designer" in required_agents:
        designer = create_designer_agent(_agent_model("designer", effective_model, agent_configs))
        steps.append((
            designer,
            "Design a visual style for this website:\n\n"
            "Site Plan: {site_plan}\n\n"
            "Logo URL: {logo_url}\n"
            "Icon URL: {icon_url}\n\n"
            "Create a cohesive color scheme, typography, and spacing system.",
        ))

    # Developer (always required)
    developer = create_developer_agent(_agent_model("developer", effective_model, agent_configs))

    if "reviewer" in required_agents:
        reviewer = create_reviewer_agent(_agent_model("reviewer", effective_model, agent_configs))

        def _exit_condition(state: dict[str, Any], iteration: int) -> bool:
            feedback_text = state.get("review_feedback", "")
            if not feedback_text:
                return False
            if '"approved": true' in feedback_text.lower() or '"approved":true' in feedback_text.lower():
                return True
            return False

        build_review_loop = LoopGroup(
            [
                (
                    developer,
                    "Build the website page based on this plan:\n\n"
                    "Site Plan: {site_plan}\n\n"
                    "Style Spec: {style_spec}\n\n"
                    "Logo URL: {logo_url}\n"
                    "Icon URL: {icon_url}\n\n"
                    "Previous review feedback (if any): {review_feedback}\n\n"
                    "Use the write_file tool to save each file. Generate complete, "
                    "self-contained HTML with inline or linked CSS/JS.",
                ),
                (
                    reviewer,
                    "Review the generated website code.\n\n"
                    "Site Plan: {site_plan}\n"
                    "Style Spec: {style_spec}\n"
                    "Developer output: {page_output}\n\n"
                    "IMPORTANT: First call the list_files tool to discover what files were generated, "
                    "then use read_file to inspect each one. "
                    f"Approve if quality score >= {threshold}.",
                ),
            ],
            exit_condition=_exit_condition,
            max_iterations=max_iters,
            callbacks=callbacks,
        )
        steps.append(build_review_loop)
    else:
        # Developer only, no review loop
        steps.append((
            developer,
            "Build the website page based on this plan:\n\n"
            "Site Plan: {site_plan}\n\n"
            "Style Spec: {style_spec}\n\n"
            "Logo URL: {logo_url}\n"
            "Icon URL: {icon_url}\n\n"
            "Use the write_file tool to save each file. Generate complete, "
            "self-contained HTML with inline or linked CSS/JS.",
        ))

    return SequentialGroup(steps, callbacks=callbacks)


def _agent_model(
    agent_key: str,
    default_model: str,
    configs: dict[str, AgentConfig] | None,
) -> str:
    """Resolve the model for an agent, respecting config overrides.

    Model strings must be in ``provider/model`` format.  If an agent
    override doesn't contain a ``/`` it is ignored (treated as invalid)
    and the default model is used instead.
    """
    if configs and agent_key in configs:
        cfg = configs[agent_key]
        if cfg.model and "/" in cfg.model:
            return cfg.model
        elif cfg.model:
            # Invalid format — skip this override
            pass
    return default_model
