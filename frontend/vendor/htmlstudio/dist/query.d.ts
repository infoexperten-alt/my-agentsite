import { type ElementInfo } from './types.js';
/** Find a single element by its `data-ve-id`. */
export declare function findById(source: string, id: string): ElementInfo | null;
/**
 * Find all elements matching a CSS selector. Only elements that carry
 * a `data-ve-id` are returned (so the caller can patch them).
 */
export declare function findAll(source: string, selector: string): ElementInfo[];
/**
 * Walk up the tree from `fromId` until an ancestor matches `selector`.
 * Returns `null` if no match.
 */
export declare function findClosest(source: string, fromId: string, selector: string): ElementInfo | null;
/** Direct element children of the element with the given id. */
export declare function getChildren(source: string, id: string): ElementInfo[];
/** Immediate element parent of the element with the given id. */
export declare function getParent(source: string, id: string): ElementInfo | null;
/**
 * Tree view of an element and its descendants, up to `maxDepth` levels.
 * Useful for giving an LLM a structural overview before bulk patches.
 */
export interface ElementNode extends ElementInfo {
    children: ElementNode[];
}
export declare function getTree(source: string, id: string, maxDepth?: number): ElementNode | null;
//# sourceMappingURL=query.d.ts.map