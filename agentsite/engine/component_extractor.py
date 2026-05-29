"""Extract a draft BlockDefinition from a selected HTML element.

The extractor walks a chunk of source HTML, finds meaningful leaves
(headings, paragraphs, links, images), and proposes one editable
`BlockField` per leaf. It also detects colors that repeat 2+ times in
inline `style` attributes and surfaces them as `accent`-style fields.

Output is a draft — the user refines it in the SaveComponentModal
before persisting. Heuristics deliberately err on the side of
*too many* fields; the UI lets the user delete or rename.
"""

from __future__ import annotations

import re
from collections import Counter
from typing import Any

from bs4 import BeautifulSoup, NavigableString, Tag

ID_ATTR = "data-ve-id"
FIELD_ATTR = "data-ve-field"

# Tags whose direct text becomes a field by default.
_TEXT_BUCKETS: dict[str, str] = {
    "h1": "heading",
    "h2": "heading",
    "h3": "heading",
    "h4": "heading",
    "h5": "heading",
    "h6": "heading",
    "p": "body",
}
_TEXTAREA_TAGS = {"p"}  # which buckets render as textarea (vs plain text)

_COLOR_RE = re.compile(
    r"#[0-9a-f]{3,8}\b|rgba?\([^)]+\)|hsla?\([^)]+\)",
    re.IGNORECASE,
)


def extract(
    source_html: str,
    *,
    default_name: str = "Custom component",
    default_slug: str = "custom-component",
) -> dict[str, Any]:
    """Extract a draft BlockDefinition from raw HTML.

    Returns a dict shaped like htmlstudio's BlockDefinition (without the
    `id` — the repo assigns one):
      { slug, name, category, description, thumbnail, template, fields }
    """
    cleaned = _strip_ve_attrs(source_html)
    soup = BeautifulSoup(cleaned, "html.parser")

    root = _root_element(soup)
    if root is None:
        return {
            "slug": default_slug,
            "name": default_name,
            "category": "custom",
            "description": "",
            "thumbnail": "🧱",
            "template": cleaned.strip() or "<div></div>",
            "fields": [],
        }

    # Walk + accumulate field assignments. We mutate `soup` in place so
    # the resulting template string carries `{{key}}` placeholders + the
    # `data-ve-field` markers (so the renderer's child outlines line up).
    counters: Counter[str] = Counter()
    fields: list[dict[str, Any]] = []

    def assign(el: Tag, kind: str, default_text: str | None = None) -> str:
        bucket = _TEXT_BUCKETS.get(el.name.lower(), kind) if kind == "auto" else kind
        counters[bucket] += 1
        key = bucket if counters[bucket] == 1 else f"{bucket}_{counters[bucket]}"
        return key

    for el in list(root.find_all(True)):
        if not isinstance(el, Tag):
            continue
        tag = el.name.lower()

        # Headings + paragraphs → text/textarea fields.
        if tag in _TEXT_BUCKETS:
            text = _direct_text(el)
            if not text:
                continue
            key = assign(el, "auto")
            field_type = "textarea" if tag in _TEXTAREA_TAGS else "text"
            fields.append({
                "key": key,
                "type": field_type,
                "label": _label_for(key),
                "default": text,
            })
            _replace_direct_text(el, f"{{{{{key}}}}}")
            el[FIELD_ATTR] = key
            continue

        # Anchors → two fields: text + href.
        if tag == "a":
            text = _direct_text(el)
            href = el.get("href", "#")
            counters["cta"] += 1
            n = counters["cta"]
            text_key = "cta_text" if n == 1 else f"cta_{n}_text"
            href_key = "cta_href" if n == 1 else f"cta_{n}_href"
            if text:
                fields.append({
                    "key": text_key,
                    "type": "text",
                    "label": _label_for(text_key),
                    "default": text,
                })
                _replace_direct_text(el, f"{{{{{text_key}}}}}")
            fields.append({
                "key": href_key,
                "type": "url",
                "label": _label_for(href_key),
                "default": href,
            })
            el["href"] = f"{{{{{href_key}}}}}"
            el[FIELD_ATTR] = text_key
            continue

        # Images → src + alt.
        if tag == "img":
            counters["image"] += 1
            n = counters["image"]
            src_key = "image" if n == 1 else f"image_{n}"
            alt_key = f"{src_key}_alt"
            fields.append({
                "key": src_key,
                "type": "image",
                "label": _label_for(src_key),
                "default": el.get("src", ""),
            })
            fields.append({
                "key": alt_key,
                "type": "text",
                "label": _label_for(alt_key),
                "default": el.get("alt", ""),
                "optional": True,
            })
            el["src"] = f"{{{{{src_key}}}}}"
            el["alt"] = f"{{{{{alt_key}}}}}"
            el[FIELD_ATTR] = src_key
            continue

    # Detect repeated colors inside inline `style` attributes and propose
    # an `accent` field for the most-common one if it appears 2+ times.
    accent_field = _detect_accent(root)
    if accent_field:
        fields.append(accent_field)

    template = str(root)

    return {
        "slug": default_slug,
        "name": default_name,
        "category": "custom",
        "description": "",
        "thumbnail": "🧱",
        "template": template,
        "fields": fields,
    }


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _strip_ve_attrs(html: str) -> str:
    """Remove the editor's own marker attributes before extraction —
    they'd leak into the template and confuse the renderer."""
    soup = BeautifulSoup(html, "html.parser")
    for el in soup.find_all(True):
        for attr in [
            "data-ve-id",
            "data-ve-hover",
            "data-ve-selected",
            "data-ve-multi",
            "data-ve-editing",
            "data-ve-runtime-id",
            "data-ve-block",
            "data-ve-block-instance",
            "data-ve-config",
            "data-ve-field",
            "contenteditable",
        ]:
            if attr in el.attrs:
                del el.attrs[attr]
    return str(soup)


def _root_element(soup: BeautifulSoup) -> Tag | None:
    for child in soup.children:
        if isinstance(child, Tag):
            return child
    return None


def _direct_text(el: Tag) -> str:
    """Concatenate immediate text-node children (not descendants)."""
    parts: list[str] = []
    for c in el.children:
        if isinstance(c, NavigableString) and not isinstance(c, Tag):
            s = str(c).strip()
            if s:
                parts.append(s)
    return " ".join(parts).strip()


def _replace_direct_text(el: Tag, replacement: str) -> None:
    """Replace the first non-empty direct text node with `replacement`."""
    for c in list(el.children):
        if isinstance(c, NavigableString) and not isinstance(c, Tag):
            if str(c).strip():
                c.replace_with(replacement)
                return
    # If no text node existed, insert one at the start
    el.insert(0, replacement)


def _detect_accent(root: Tag) -> dict[str, Any] | None:
    """Find the most common color string that appears 2+ times in inline
    styles. Returns a draft field or None."""
    counter: Counter[str] = Counter()
    for el in root.find_all(True):
        style = el.get("style", "")
        if not style:
            continue
        for match in _COLOR_RE.findall(style):
            counter[match.lower()] += 1
    if not counter:
        return None
    most, count = counter.most_common(1)[0]
    if count < 2:
        return None
    # Replace literal occurrences with the placeholder
    for el in root.find_all(True):
        style = el.get("style", "")
        if not style:
            continue
        new_style = re.sub(
            re.escape(most),
            "{{accent}}",
            style,
            flags=re.IGNORECASE,
        )
        if new_style != style:
            el["style"] = new_style
    return {
        "key": "accent",
        "type": "color",
        "label": "Accent color",
        "default": most,
    }


def _label_for(key: str) -> str:
    """Pretty-print a snake_case key for the UI."""
    return key.replace("_", " ").capitalize()
