export declare const ID_ATTR = "data-ve-id";
export declare const BLOCK_ATTR = "data-ve-block";
export type EditableKind = 'text' | 'link' | 'image' | 'container' | 'unknown';
export interface ElementInfo {
    id: string;
    tag: string;
    kind: EditableKind;
    text?: string;
    attributes: Record<string, string>;
    rect?: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
}
export type Patch = {
    kind: 'set-text';
    id: string;
    value: string;
} | {
    kind: 'set-link';
    id: string;
    href: string;
    text: string;
} | {
    kind: 'set-image';
    id: string;
    src: string;
    alt: string;
} | {
    kind: 'set-style';
    id: string;
    styles: Record<string, string>;
} | {
    kind: 'set-attributes';
    id: string;
    attributes: Record<string, string | null>;
} | {
    kind: 'set-outer-html';
    id: string;
    html: string;
} | {
    kind: 'set-full-source';
    source: string;
};
export interface PatchResult {
    ok: boolean;
    source: string;
    error?: string;
}
export interface BridgeMessage<T = unknown> {
    channel: 've';
    type: string;
    payload: T;
}
export type BridgeEvent = {
    type: 'ready';
    payload: {
        count: number;
    };
} | {
    type: 'hover';
    payload: ElementInfo | null;
} | {
    type: 'select';
    payload: ElementInfo | null;
} | {
    type: 'dblclick-text';
    payload: {
        id: string;
        value: string;
    };
};
//# sourceMappingURL=types.d.ts.map