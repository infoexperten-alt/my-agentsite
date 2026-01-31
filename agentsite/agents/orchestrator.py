"""Pipeline orchestration using Prompture groups."""

from __future__ import annotations

from typing import Any

from prompture import GroupCallbacks, LoopGroup, SequentialGroup

from ..config import settings
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
) -> SequentialGroup:
    """Build the full generation pipeline.

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
    """
    effective_model = model or settings.default_model
    max_iters = max_review_iterations or settings.max_review_iterations
    threshold = review_threshold or settings.review_approval_threshold

    pm = create_pm_agent(effective_model)
    designer = create_designer_agent(effective_model)
    developer = create_developer_agent(effective_model)
    reviewer = create_reviewer_agent(effective_model)

    # Build+Review loop: exit when approved or max iterations reached
    def _exit_condition(state: dict[str, Any], iteration: int) -> bool:
        feedback_text = state.get("review_feedback", "")
        if not feedback_text:
            return False
        # Check for approval in the raw output text
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
                "Use the read_file tool to inspect the generated files. "
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
                "Create a cohesive color scheme, typography, and spacing system.",
            ),
            build_review_loop,
        ],
        callbacks=callbacks,
    )

    return pipeline
