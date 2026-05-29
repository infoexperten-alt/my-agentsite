import { parse } from 'node-html-parser';
import { BLOCK_ATTR, ID_ATTR } from './types.js';
/**
 * Structural query helpers operating on a tagged HTML source string.
 *
 * Every function takes the raw source (HTML with `data-ve-id` already
 * stamped) and returns lightweight ElementInfo objects — no live DOM,
 * no mutation. Use these for inspection / discovery; use `applyPatch`
 * for changes.
 */
const TAGGABLE_DEFAULT_KIND_MAP = {
    a: 'link',
    img: 'image',
};
function inferKind(el) {
    const tag = el.rawTagName?.toLowerCase();
    if (!tag)
        return 'unknown';
    if (TAGGABLE_DEFAULT_KIND_MAP[tag])
        return TAGGABLE_DEFAULT_KIND_MAP[tag];
    return hasElementChildren(el) ? 'container' : 'text';
}
function hasElementChildren(el) {
    return el.childNodes.some((c) => c.rawTagName);
}
function toInfo(el) {
    const attributes = {};
    for (const [k, v] of Object.entries(el.attributes || {})) {
        if (typeof v === 'string')
            attributes[k] = v;
    }
    const kind = inferKind(el);
    const text = kind === 'text' ? el.text.trim() : undefined;
    const block = el.getAttribute(BLOCK_ATTR) || undefined;
    return {
        id: el.getAttribute(ID_ATTR) || '',
        tag: el.rawTagName?.toLowerCase() || '',
        kind,
        text,
        attributes,
        ...(block ? { block } : {}),
    };
}
function cssEscape(s) {
    return s.replace(/(["\\])/g, '\\$1');
}
function parseRoot(source) {
    return parse(source, { lowerCaseTagName: false, comment: true });
}
/** Find a single element by its `data-ve-id`. */
export function findById(source, id) {
    const el = parseRoot(source).querySelector(`[${ID_ATTR}="${cssEscape(id)}"]`);
    return el ? toInfo(el) : null;
}
/**
 * Find all elements matching a CSS selector. Only elements that carry
 * a `data-ve-id` are returned (so the caller can patch them).
 */
export function findAll(source, selector) {
    const root = parseRoot(source);
    const matches = root.querySelectorAll(selector);
    return matches
        .filter((el) => !!el.getAttribute(ID_ATTR))
        .map(toInfo);
}
/**
 * Walk up the tree from `fromId` until an ancestor matches `selector`.
 * Returns `null` if no match.
 */
export function findClosest(source, fromId, selector) {
    const root = parseRoot(source);
    const start = root.querySelector(`[${ID_ATTR}="${cssEscape(fromId)}"]`);
    if (!start)
        return null;
    // node-html-parser supports closest() on elements
    const match = start.closest(selector);
    if (!match)
        return null;
    if (!match.getAttribute(ID_ATTR)) {
        // Walk further up looking for the first ancestor that matches AND has an id
        let cursor = match.parentNode;
        while (cursor) {
            const c = cursor;
            if (typeof c.matches === 'function' && c.matches(selector) && c.getAttribute(ID_ATTR)) {
                return toInfo(cursor);
            }
            cursor = cursor.parentNode;
        }
        return null;
    }
    return toInfo(match);
}
/** Direct element children of the element with the given id. */
export function getChildren(source, id) {
    const root = parseRoot(source);
    const el = root.querySelector(`[${ID_ATTR}="${cssEscape(id)}"]`);
    if (!el)
        return [];
    return el.childNodes
        .filter((c) => c.rawTagName)
        .map((c) => toInfo(c))
        .filter((info) => !!info.id);
}
/** Immediate element parent of the element with the given id. */
export function getParent(source, id) {
    const root = parseRoot(source);
    const el = root.querySelector(`[${ID_ATTR}="${cssEscape(id)}"]`);
    if (!el)
        return null;
    const parent = el.parentNode;
    if (!parent || !parent.rawTagName)
        return null;
    if (!parent.getAttribute(ID_ATTR))
        return null;
    return toInfo(parent);
}
export function getTree(source, id, maxDepth = 3) {
    const root = parseRoot(source);
    const el = root.querySelector(`[${ID_ATTR}="${cssEscape(id)}"]`);
    if (!el)
        return null;
    return walk(el, 0, maxDepth);
}
function walk(el, depth, maxDepth) {
    const info = toInfo(el);
    const node = { ...info, children: [] };
    if (depth >= maxDepth)
        return node;
    for (const c of el.childNodes) {
        const child = c;
        if (!child.rawTagName || !child.getAttribute(ID_ATTR))
            continue;
        node.children.push(walk(child, depth + 1, maxDepth));
    }
    return node;
}
//# sourceMappingURL=query.js.map