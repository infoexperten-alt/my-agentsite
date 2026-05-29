export interface BridgeOptions {
    /** Origin to scope postMessage to. Default '*' — set this in production. */
    targetOrigin?: string;
    /** Selector for elements the bridge will consider interactive. */
    discoverySelector?: string;
    /** Show hover/select outlines. Default true. */
    outlines?: boolean;
    /** Channel id, useful when multiple bridges share a window. Default 've'. */
    channel?: string;
}
/**
 * Returns a `<style>` + `<script>` pair to inject into the preview iframe.
 *
 * Events posted to parent (channel: `ve`):
 *   - ready      { count }
 *   - hover      ElementInfo | null
 *   - select     ElementInfo | null            — single click
 *   - select-multi ElementInfo[]               — shift-click accumulates a set
 *   - dblclick-text { id, value }
 *   - query-result { queryId, results: ElementInfo[] }
 *
 * Commands accepted from parent:
 *   - highlight  { id }                        — outline that element
 *   - clear                                    — clear all outlines + selection
 *   - query      { queryId, selector }         — find elements, reply with query-result
 */
export declare function buildBridgeScript(options?: BridgeOptions): string;
/**
 * Inject the bridge into a full HTML document string (before </body>).
 * Safe to call on already-bridged HTML — replaces the existing bridge tag.
 */
export declare function injectBridge(html: string, options?: BridgeOptions): string;
//# sourceMappingURL=bridge.d.ts.map