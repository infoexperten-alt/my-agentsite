"""Discovery step — 30-second clarifier collected before PM runs.

Ported from open-design (`apps/daemon/src/prompts/discovery.ts`). Open Design's
form is delivered live in chat as a `<question-form id="discovery">` block; in
AgentSite the form schema is exposed via `GET /api/discovery/form`, the
frontend renders it, and the answers are POSTed alongside the generation
request as a structured `DiscoveryBrief` (see `agentsite/models.py`).

This module owns:
- the form schema (kept verbatim with OD's `value` keys so future routing
  rules can branch on them),
- the brief→text rendering used to inject context into the PM / Designer /
  Developer system prompts.
"""

from __future__ import annotations

from ..models import DiscoveryBrief

DISCOVERY_FORM_SCHEMA: dict = {
    "id": "discovery",
    "title": "Quick brief — 30 seconds",
    "description": "I'll lock these in before building. Skip what doesn't apply — I'll fill defaults.",
    "questions": [
        {
            "id": "output",
            "label": "What are we making?",
            "type": "radio",
            "required": True,
            "options": [
                {"label": "Slide deck / pitch", "value": "slide_deck"},
                {"label": "Single web prototype / landing", "value": "web_prototype"},
                {"label": "Multi-screen app prototype", "value": "app_prototype"},
                {"label": "Dashboard / tool UI", "value": "dashboard"},
                {"label": "Editorial / marketing page", "value": "editorial"},
                {"label": "Other — I'll describe", "value": "other"},
            ],
        },
        {
            "id": "platform",
            "label": "Target platform",
            "type": "checkbox",
            "maxSelections": 4,
            "options": [
                {"label": "Responsive web", "value": "responsive_web"},
                {"label": "Desktop web", "value": "desktop_web"},
                {"label": "iOS app", "value": "ios"},
                {"label": "Android app", "value": "android"},
                {"label": "Tablet app", "value": "tablet"},
                {"label": "Desktop app", "value": "desktop_app"},
                {"label": "Fixed canvas (1920x1080)", "value": "fixed_canvas"},
            ],
        },
        {
            "id": "audience",
            "label": "Who is this for?",
            "type": "text",
            "placeholder": "e.g. early-stage investors, dev-tools buyers, internal exec review",
        },
        {
            "id": "tone",
            "label": "Visual tone",
            "type": "checkbox",
            "maxSelections": 2,
            "options": [
                {"label": "Editorial / magazine", "value": "editorial"},
                {"label": "Modern minimal", "value": "modern_minimal"},
                {"label": "Playful / illustrative", "value": "playful"},
                {"label": "Tech / utility", "value": "tech_utility"},
                {"label": "Luxury / refined", "value": "luxury"},
                {"label": "Brutalist / experimental", "value": "brutalist"},
                {"label": "Human / approachable", "value": "human"},
            ],
        },
        {
            "id": "brand",
            "label": "Brand context",
            "type": "radio",
            "options": [
                {"label": "Pick a direction for me", "value": "pick_direction"},
                {"label": "I have a brand spec — I'll share it", "value": "brand_spec"},
                {"label": "Match a reference site / screenshot — I'll attach it", "value": "reference_match"},
            ],
        },
        {
            "id": "scale",
            "label": "Roughly how much?",
            "type": "text",
            "placeholder": "e.g. 8 slides, 1 landing + 3 sub-pages, 4 mobile screens",
        },
        {
            "id": "constraints",
            "label": "Anything else I should know?",
            "type": "textarea",
            "placeholder": "Real copy, fonts you must use, things to avoid, deadline…",
        },
    ],
}


def brief_from_form(answers: dict) -> DiscoveryBrief:
    """Build a DiscoveryBrief from raw form answers.

    Tolerates missing keys, single-string answers where a list is expected, and
    the `brand`→`brand_mode` rename.
    """
    if not isinstance(answers, dict):
        return DiscoveryBrief()

    def _as_list(v):
        if v is None:
            return []
        if isinstance(v, list):
            return [str(x) for x in v if x]
        return [str(v)]

    return DiscoveryBrief(
        output=str(answers.get("output", "") or ""),
        platform=_as_list(answers.get("platform")),
        audience=str(answers.get("audience", "") or ""),
        tone=_as_list(answers.get("tone")),
        brand_mode=str(answers.get("brand_mode") or answers.get("brand") or "pick_direction"),
        scale=str(answers.get("scale", "") or ""),
        constraints=str(answers.get("constraints", "") or ""),
        direction_id=(answers.get("direction_id") or None),
    )


def render_brief(brief: DiscoveryBrief | None) -> str:
    """Render the brief as a compact markdown block for prompt injection.

    Returns empty string when ``brief`` is None so callers can unconditionally
    interpolate ``{discovery_brief}`` without worrying about empty defaults.
    """
    if brief is None:
        return ""

    lines = ["## Discovery brief"]
    if brief.output:
        lines.append(f"- **Surface:** {brief.output}")
    if brief.platform:
        lines.append(f"- **Platform:** {', '.join(brief.platform)}")
    if brief.audience:
        lines.append(f"- **Audience:** {brief.audience}")
    if brief.tone:
        lines.append(f"- **Tone:** {', '.join(brief.tone)}")
    if brief.brand_mode:
        lines.append(f"- **Brand mode:** {brief.brand_mode}")
    if brief.direction_id:
        lines.append(f"- **Direction:** {brief.direction_id}")
    if brief.scale:
        lines.append(f"- **Scale:** {brief.scale}")
    if brief.constraints:
        lines.append(f"- **Constraints:** {brief.constraints}")

    if len(lines) == 1:
        return ""
    return "\n".join(lines)
