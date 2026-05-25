/**
 * Block primitives — reusable components with declared editable fields.
 *
 * A block is HTML template + a typed schema of its editable surface.
 * Instances are stamped into the page source with `data-ve-block` and
 * `data-ve-block-instance` so the editor can recognise them and swap the
 * generic CSS inspector for a typed config form.
 *
 * v0.3 ships:
 *   - Type definitions
 *   - renderBlock() — substitutes config into the template
 *   - readBlockConfig() / updateBlockConfig() — round-trip the JSON config
 *   - BUILTIN_BLOCKS — four starter blocks (hero / cta / features / quote)
 *
 * Deferred to v0.4: data sources (RSS / JSON / REST hydration).
 */
export declare const BLOCK_INSTANCE_ATTR = "data-ve-block-instance";
export declare const BLOCK_CONFIG_ATTR = "data-ve-config";
export declare const BLOCK_FIELD_ATTR = "data-ve-field";
export type BlockFieldType = 'text' | 'textarea' | 'url' | 'image' | 'color' | 'select' | 'number' | 'boolean';
export interface BlockFieldOption {
    label: string;
    value: string;
}
export interface BlockField {
    /** Key used in the template as `{{key}}` and in config JSON. */
    key: string;
    /** UI input kind. */
    type: BlockFieldType;
    /** Human-readable label shown in the config form. */
    label: string;
    /** Placeholder / help text. */
    help?: string;
    /** Default value if not provided in config. */
    default?: string | number | boolean;
    /** Choices for `type: 'select'`. */
    options?: BlockFieldOption[];
    /** When true, allow empty/null values. Default false. */
    optional?: boolean;
}
export type BlockCategory = 'hero' | 'cta' | 'list' | 'media' | 'layout' | 'social';
export interface BlockDefinition {
    /** Stable id used in `data-ve-block`. */
    id: string;
    /** Human-readable display name. */
    name: string;
    /** Category for grouping in the palette. */
    category: BlockCategory;
    /** Short pitch shown under the thumbnail. */
    description: string;
    /** Emoji or icon glyph for the palette card (Phase 4 swaps for real thumbnails). */
    thumbnail: string;
    /** HTML template using `{{key}}` placeholders. */
    template: string;
    /** Declared editable fields. */
    fields: BlockField[];
}
/**
 * Render a block as HTML, ready to insert into a page source.
 *
 * The outer element is stamped with `data-ve-block` / `data-ve-block-instance`
 * / `data-ve-config` so the editor can later read the config back and re-render
 * on edit. The `instanceId` defaults to a short random id if not given.
 */
export declare function renderBlock(def: BlockDefinition, config?: Record<string, string | number | boolean>, options?: {
    instanceId?: string;
}): string;
/** Pull the JSON config stored on an instance. Returns {} when missing. */
export declare function readBlockConfig(source: string, instanceId: string): Record<string, unknown>;
/**
 * Re-render an existing block instance from a new config. Returns the new
 * outer HTML string ready to feed into a `set-outer-html` patch (the caller
 * already has the instance's `data-ve-id`).
 */
export declare function renderBlockUpdate(def: BlockDefinition, config: Record<string, string | number | boolean>, instanceId: string): string;
export interface BlockRegistry {
    list(): BlockDefinition[];
    get(id: string): BlockDefinition | undefined;
}
export declare function createRegistry(defs: BlockDefinition[]): BlockRegistry;
/**
 * Four hand-tuned starter blocks. The templates lean on inline styles so
 * they render the same regardless of the surrounding page's CSS — important
 * because htmlstudio doesn't know the host's design system.
 */
export declare const BUILTIN_BLOCKS: BlockDefinition[];
export declare const BUILTIN_REGISTRY: BlockRegistry;
//# sourceMappingURL=blocks.d.ts.map