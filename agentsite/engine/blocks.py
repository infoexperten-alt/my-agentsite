"""Server-side mirror of htmlstudio's block registry.

Only the *metadata + render* path lives here — the agent needs to be
able to list block ids and render templates to emit `set-outer-html`
patches. Round-tripping a block's config (read / update) stays
client-side via htmlstudio's `readBlockConfig` / `renderBlockUpdate`.

Definitions are imported from a JSON manifest co-located with the
vendored htmlstudio package, so the source of truth is htmlstudio's
TS code and this module is a thin viewer.

NOTE — for v0.3 the definitions are inlined as Python data because we
have only four blocks and the htmlstudio TS file isn't trivial to
import from Python. When the block count grows, switch this to read a
generated JSON file produced from htmlstudio's TS.
"""

from __future__ import annotations

import base64
import json
import re
import secrets
from typing import Any

BLOCK_ATTR = "data-ve-block"
BLOCK_INSTANCE_ATTR = "data-ve-block-instance"
BLOCK_CONFIG_ATTR = "data-ve-config"
BLOCK_FIELD_ATTR = "data-ve-field"


_PLACEHOLDER = re.compile(r"\{\{\s*([a-zA-Z0-9_-]+)\s*\}\}")
_OPENING_TAG = re.compile(r"^\s*<([a-zA-Z][a-zA-Z0-9]*)([^>]*)>")


def _escape_html(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _encode_config(config: dict[str, Any]) -> str:
    return base64.b64encode(json.dumps(config).encode("utf-8")).decode("ascii")


def _substitute(template: str, values: dict[str, str]) -> str:
    def repl(m: re.Match[str]) -> str:
        v = values.get(m.group(1))
        return "" if v is None else _escape_html(str(v))
    return _PLACEHOLDER.sub(repl, template)


def _defaults_for(definition: dict[str, Any]) -> dict[str, str]:
    out: dict[str, str] = {}
    for f in definition.get("fields", []):
        d = f.get("default")
        if d is not None:
            out[f["key"]] = str(d)
    return out


def render_block(
    definition: dict[str, Any],
    config: dict[str, Any] | None = None,
    *,
    instance_id: str | None = None,
) -> str:
    """Render a block to HTML, stamped with block-instance markers."""
    config = config or {}
    merged = _defaults_for(definition)
    for k, v in config.items():
        if v is not None:
            merged[k] = str(v)
    body = _substitute(definition["template"], merged)

    iid = instance_id or "b-" + secrets.token_urlsafe(4)[:6]
    cfg_b64 = _encode_config(config)

    m = _OPENING_TAG.match(body)
    if not m:
        return (
            f'<div {BLOCK_ATTR}="{definition["id"]}" '
            f'{BLOCK_INSTANCE_ATTR}="{iid}" '
            f'{BLOCK_CONFIG_ATTR}="{cfg_b64}">{body}</div>'
        )
    tag = m.group(1)
    existing = m.group(2)
    opener = (
        f'<{tag} {BLOCK_ATTR}="{definition["id"]}" '
        f'{BLOCK_INSTANCE_ATTR}="{iid}" '
        f'{BLOCK_CONFIG_ATTR}="{cfg_b64}"{existing}>'
    )
    return body.replace(m.group(0), opener, 1)


# ---------------------------------------------------------------------------
# Starter blocks — kept in sync manually with htmlstudio/src/blocks.ts.
# Tests below verify ids match what the frontend ships. Update both files
# together when adding a new block.
# ---------------------------------------------------------------------------

BUILTIN_BLOCKS: list[dict[str, Any]] = [
    {
        "id": "hero-split",
        "name": "Hero — Split",
        "category": "hero",
        "description": "Headline + subhead + CTA on the left, image on the right.",
        "thumbnail": "🦸",
        "template": (
            '<section style="display:grid;grid-template-columns:1fr 1fr;gap:48px;padding:80px 40px;max-width:1200px;margin:0 auto;align-items:center;font-family:system-ui,sans-serif;">'
            '<div>'
            '<h1 ' + BLOCK_FIELD_ATTR + '="heading" style="font-size:48px;line-height:1.1;margin:0 0 16px;color:#0f172a;">{{heading}}</h1>'
            '<p ' + BLOCK_FIELD_ATTR + '="subhead" style="font-size:18px;line-height:1.5;color:#475569;margin:0 0 32px;">{{subhead}}</p>'
            '<a ' + BLOCK_FIELD_ATTR + '="cta_text" href="{{cta_href}}" style="display:inline-block;padding:14px 28px;background:{{accent}};color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">{{cta_text}}</a>'
            '</div>'
            '<img ' + BLOCK_FIELD_ATTR + '="image" src="{{image}}" alt="{{image_alt}}" style="width:100%;border-radius:12px;box-shadow:0 12px 32px rgba(0,0,0,0.12);"/>'
            '</section>'
        ),
        "fields": [
            {"key": "heading", "type": "text", "label": "Headline", "default": "Build something people actually use"},
            {"key": "subhead", "type": "textarea", "label": "Sub-headline", "default": "A two-line pitch that earns the click."},
            {"key": "cta_text", "type": "text", "label": "CTA label", "default": "Get started"},
            {"key": "cta_href", "type": "url", "label": "CTA link", "default": "#signup"},
            {"key": "accent", "type": "color", "label": "Accent color", "default": "#2563eb"},
            {"key": "image", "type": "image", "label": "Image URL", "default": "https://placehold.co/600x400"},
            {"key": "image_alt", "type": "text", "label": "Image alt text", "default": "product screenshot"},
        ],
    },
    {
        "id": "cta-banner",
        "name": "CTA Banner",
        "category": "cta",
        "description": "Full-width call to action with one button.",
        "thumbnail": "📣",
        "template": (
            '<section style="background:{{background}};color:{{text_color}};padding:64px 40px;text-align:center;font-family:system-ui,sans-serif;">'
            '<h2 ' + BLOCK_FIELD_ATTR + '="heading" style="font-size:36px;margin:0 0 12px;">{{heading}}</h2>'
            '<p ' + BLOCK_FIELD_ATTR + '="subhead" style="font-size:17px;opacity:0.85;margin:0 auto 28px;max-width:560px;line-height:1.5;">{{subhead}}</p>'
            '<a ' + BLOCK_FIELD_ATTR + '="cta_text" href="{{cta_href}}" style="display:inline-block;padding:14px 32px;background:{{button_bg}};color:{{button_color}};border-radius:8px;text-decoration:none;font-weight:600;">{{cta_text}}</a>'
            '</section>'
        ),
        "fields": [
            {"key": "heading", "type": "text", "label": "Headline", "default": "Ready when you are"},
            {"key": "subhead", "type": "textarea", "label": "Sub-headline", "default": "Start free. Upgrade only when you need to."},
            {"key": "cta_text", "type": "text", "label": "Button text", "default": "Start free"},
            {"key": "cta_href", "type": "url", "label": "Button link", "default": "#signup"},
            {"key": "background", "type": "color", "label": "Background", "default": "#0f172a"},
            {"key": "text_color", "type": "color", "label": "Text color", "default": "#ffffff"},
            {"key": "button_bg", "type": "color", "label": "Button background", "default": "#ffffff"},
            {"key": "button_color", "type": "color", "label": "Button text color", "default": "#0f172a"},
        ],
    },
    {
        "id": "feature-grid-3",
        "name": "Features — 3 columns",
        "category": "list",
        "description": "Three icon-headline-body cards in a row.",
        "thumbnail": "🧩",
        "template": (
            '<section style="padding:80px 40px;max-width:1200px;margin:0 auto;font-family:system-ui,sans-serif;">'
            '<h2 ' + BLOCK_FIELD_ATTR + '="section_title" style="text-align:center;font-size:32px;margin:0 0 48px;color:#0f172a;">{{section_title}}</h2>'
            '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:32px;">'
            '<div style="padding:24px;border:1px solid #e2e8f0;border-radius:12px;">'
            '<div style="font-size:36px;margin-bottom:12px;">{{icon_1}}</div>'
            '<h3 ' + BLOCK_FIELD_ATTR + '="title_1" style="margin:0 0 8px;font-size:18px;color:#0f172a;">{{title_1}}</h3>'
            '<p ' + BLOCK_FIELD_ATTR + '="body_1" style="margin:0;color:#475569;line-height:1.55;">{{body_1}}</p>'
            '</div>'
            '<div style="padding:24px;border:1px solid #e2e8f0;border-radius:12px;">'
            '<div style="font-size:36px;margin-bottom:12px;">{{icon_2}}</div>'
            '<h3 ' + BLOCK_FIELD_ATTR + '="title_2" style="margin:0 0 8px;font-size:18px;color:#0f172a;">{{title_2}}</h3>'
            '<p ' + BLOCK_FIELD_ATTR + '="body_2" style="margin:0;color:#475569;line-height:1.55;">{{body_2}}</p>'
            '</div>'
            '<div style="padding:24px;border:1px solid #e2e8f0;border-radius:12px;">'
            '<div style="font-size:36px;margin-bottom:12px;">{{icon_3}}</div>'
            '<h3 ' + BLOCK_FIELD_ATTR + '="title_3" style="margin:0 0 8px;font-size:18px;color:#0f172a;">{{title_3}}</h3>'
            '<p ' + BLOCK_FIELD_ATTR + '="body_3" style="margin:0;color:#475569;line-height:1.55;">{{body_3}}</p>'
            '</div>'
            '</div>'
            '</section>'
        ),
        "fields": [
            {"key": "section_title", "type": "text", "label": "Section title", "default": "Why it works"},
            {"key": "icon_1", "type": "text", "label": "Card 1 icon", "default": "⚡"},
            {"key": "title_1", "type": "text", "label": "Card 1 title", "default": "Fast by default"},
            {"key": "body_1", "type": "textarea", "label": "Card 1 body", "default": "Edge-first architecture, sub-100ms page loads."},
            {"key": "icon_2", "type": "text", "label": "Card 2 icon", "default": "🔒"},
            {"key": "title_2", "type": "text", "label": "Card 2 title", "default": "Private by design"},
            {"key": "body_2", "type": "textarea", "label": "Card 2 body", "default": "Your data never leaves your tenancy."},
            {"key": "icon_3", "type": "text", "label": "Card 3 icon", "default": "🤝"},
            {"key": "title_3", "type": "text", "label": "Card 3 title", "default": "Honest pricing"},
            {"key": "body_3", "type": "textarea", "label": "Card 3 body", "default": "Pay for usage, not seats. No surprise invoices."},
        ],
    },
    {
        "id": "testimonial-quote",
        "name": "Testimonial Quote",
        "category": "social",
        "description": "Single large quote with attribution.",
        "thumbnail": "💬",
        "template": (
            '<section style="padding:64px 40px;max-width:840px;margin:0 auto;text-align:center;font-family:system-ui,sans-serif;">'
            '<p ' + BLOCK_FIELD_ATTR + '="quote" style="font-size:24px;line-height:1.5;color:#0f172a;margin:0 0 24px;font-style:italic;">"{{quote}}"</p>'
            '<div style="display:flex;align-items:center;justify-content:center;gap:12px;">'
            '<img ' + BLOCK_FIELD_ATTR + '="avatar" src="{{avatar}}" alt="{{name}}" style="width:48px;height:48px;border-radius:9999px;object-fit:cover;"/>'
            '<div style="text-align:left;">'
            '<div ' + BLOCK_FIELD_ATTR + '="name" style="font-weight:600;color:#0f172a;">{{name}}</div>'
            '<div ' + BLOCK_FIELD_ATTR + '="role" style="font-size:13px;color:#64748b;">{{role}}</div>'
            '</div>'
            '</div>'
            '</section>'
        ),
        "fields": [
            {"key": "quote", "type": "textarea", "label": "Quote", "default": "It paid for itself in the first week — and our designers stopped opening tickets for copy tweaks."},
            {"key": "name", "type": "text", "label": "Name", "default": "Alex Rivera"},
            {"key": "role", "type": "text", "label": "Role", "default": "Head of Product, Northwind"},
            {"key": "avatar", "type": "image", "label": "Avatar URL", "default": "https://placehold.co/96x96"},
        ],
    },
]


def get_block(block_id: str) -> dict[str, Any] | None:
    for b in BUILTIN_BLOCKS:
        if b["id"] == block_id:
            return b
    return None


def list_blocks() -> list[dict[str, Any]]:
    return BUILTIN_BLOCKS
