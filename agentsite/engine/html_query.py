"""Read-only structural query helpers over tagged HTML source.

Mirrors `htmlstudio/src/query.ts` so the chat agent can introspect a
page server-side without subprocessing into Node. Patch application
stays on the frontend — this module is *only* for discovery (find,
get_tree, etc.).

The HTML must already carry `data-ve-id` attributes (stamped on save by
the visual editor flow).
"""

from __future__ import annotations

from typing import Any

from bs4 import BeautifulSoup, Tag

ID_ATTR = "data-ve-id"
BLOCK_ATTR = "data-ve-block"

_TEXT_TAGS = {
    "a": "link",
    "img": "image",
}


def _parse(source: str) -> BeautifulSoup:
    # BS4 with lxml is faster but lxml is a binary dep; html.parser is stdlib.
    return BeautifulSoup(source, "html.parser")


def _has_element_children(el: Tag) -> bool:
    return any(isinstance(c, Tag) for c in el.children)


def _kind(el: Tag) -> str:
    name = (el.name or "").lower()
    if name in _TEXT_TAGS:
        return _TEXT_TAGS[name]
    return "container" if _has_element_children(el) else "text"


def _info(el: Tag) -> dict[str, Any]:
    attrs: dict[str, str] = {}
    for k, v in (el.attrs or {}).items():
        # bs4 returns list for multi-valued attrs (e.g. class) — flatten for
        # the LLM, which only needs human-readable values.
        if isinstance(v, list):
            attrs[k] = " ".join(v)
        elif v is not None:
            attrs[k] = str(v)
    kind = _kind(el)
    info: dict[str, Any] = {
        "id": attrs.get(ID_ATTR, ""),
        "tag": (el.name or "").lower(),
        "kind": kind,
        "attributes": attrs,
    }
    if kind == "text":
        info["text"] = el.get_text(strip=True)
    block = attrs.get(BLOCK_ATTR)
    if block:
        info["block"] = block
    return info


def find_by_id(source: str, id: str) -> dict[str, Any] | None:
    """Return ElementInfo for the element with the given `data-ve-id`."""
    soup = _parse(source)
    el = soup.find(attrs={ID_ATTR: id})
    if not isinstance(el, Tag):
        return None
    return _info(el)


def find_all(source: str, selector: str, *, limit: int = 50) -> list[dict[str, Any]]:
    """Return ElementInfo for every element matching the CSS selector.

    Only elements that already carry a `data-ve-id` are returned (so the
    caller can patch them). Results are capped at `limit` to keep tool
    output bounded.
    """
    soup = _parse(source)
    out: list[dict[str, Any]] = []
    for el in soup.select(selector, limit=limit):
        if not isinstance(el, Tag):
            continue
        if not el.attrs.get(ID_ATTR):
            continue
        out.append(_info(el))
    return out


def find_closest(source: str, from_id: str, selector: str) -> dict[str, Any] | None:
    """Walk up the tree from `from_id` until an ancestor matches `selector`
    AND carries a `data-ve-id`."""
    soup = _parse(source)
    start = soup.find(attrs={ID_ATTR: from_id})
    if not isinstance(start, Tag):
        return None
    cursor: Tag | None = start
    while cursor is not None:
        try:
            matches = cursor in soup.select(selector)
        except Exception:
            matches = False
        if matches and cursor.attrs.get(ID_ATTR):
            return _info(cursor)
        parent = cursor.parent
        cursor = parent if isinstance(parent, Tag) else None
    return None


def get_children(source: str, id: str) -> list[dict[str, Any]]:
    """Direct element children that carry a `data-ve-id`."""
    soup = _parse(source)
    el = soup.find(attrs={ID_ATTR: id})
    if not isinstance(el, Tag):
        return []
    return [_info(c) for c in el.children if isinstance(c, Tag) and c.attrs.get(ID_ATTR)]


def get_parent(source: str, id: str) -> dict[str, Any] | None:
    """Immediate parent element that carries a `data-ve-id`."""
    soup = _parse(source)
    el = soup.find(attrs={ID_ATTR: id})
    if not isinstance(el, Tag):
        return None
    parent = el.parent
    if not isinstance(parent, Tag) or not parent.attrs.get(ID_ATTR):
        return None
    return _info(parent)


def get_tree(source: str, id: str, max_depth: int = 3) -> dict[str, Any] | None:
    """Nested tree of `id` and its taggable descendants, up to `max_depth`."""
    soup = _parse(source)
    el = soup.find(attrs={ID_ATTR: id})
    if not isinstance(el, Tag):
        return None
    return _walk(el, 0, max_depth)


def _walk(el: Tag, depth: int, max_depth: int) -> dict[str, Any]:
    node = _info(el)
    node["children"] = []
    if depth >= max_depth:
        return node
    for c in el.children:
        if not isinstance(c, Tag) or not c.attrs.get(ID_ATTR):
            continue
        node["children"].append(_walk(c, depth + 1, max_depth))
    return node


def load_current_source(pm: Any, project_id: str, slug: str, version: int) -> str:
    """Helper for chat tools: read the on-disk HTML for the active edit."""
    content = pm.read_version_file(project_id, slug, version, "index.html")
    if content is None:
        raise FileNotFoundError(f"index.html not found in {project_id}/{slug} v{version}")
    return content
