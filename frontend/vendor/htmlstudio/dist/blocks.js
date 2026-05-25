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
import { parse } from 'node-html-parser';
import { BLOCK_ATTR } from './types.js';
export const BLOCK_INSTANCE_ATTR = 'data-ve-block-instance';
export const BLOCK_CONFIG_ATTR = 'data-ve-config';
export const BLOCK_FIELD_ATTR = 'data-ve-field';
/* ----------------------------- render -------------------------------- */
function defaultsFor(def) {
    const out = {};
    for (const f of def.fields) {
        if (f.default !== undefined)
            out[f.key] = String(f.default);
    }
    return out;
}
function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
/**
 * Encode the JSON config as base64 — sidesteps every HTML-attribute
 * escaping quirk in every parser. The cost is an opaque attribute value;
 * we accept that since this is a machine-only round trip.
 */
function encodeConfig(config) {
    const json = JSON.stringify(config);
    if (typeof btoa === 'function')
        return btoa(unescape(encodeURIComponent(json)));
    // Node fallback
    return Buffer.from(json, 'utf8').toString('base64');
}
function decodeConfig(raw) {
    try {
        const json = typeof atob === 'function'
            ? decodeURIComponent(escape(atob(raw)))
            : Buffer.from(raw, 'base64').toString('utf8');
        return JSON.parse(json);
    }
    catch {
        return {};
    }
}
function substitute(template, values) {
    return template.replace(/\{\{\s*([a-zA-Z0-9_-]+)\s*\}\}/g, (_, key) => {
        const v = values[key];
        return v == null ? '' : escapeHtml(String(v));
    });
}
/**
 * Render a block as HTML, ready to insert into a page source.
 *
 * The outer element is stamped with `data-ve-block` / `data-ve-block-instance`
 * / `data-ve-config` so the editor can later read the config back and re-render
 * on edit. The `instanceId` defaults to a short random id if not given.
 */
export function renderBlock(def, config = {}, options = {}) {
    const merged = { ...defaultsFor(def) };
    for (const [k, v] of Object.entries(config)) {
        if (v != null)
            merged[k] = String(v);
    }
    const body = substitute(def.template, merged);
    const instanceId = options.instanceId ?? randomId();
    const cfgB64 = encodeConfig(config);
    // Stamp the outer element. We require the template to start with a
    // single root element — splice the marker attributes into its opening tag.
    const tagMatch = body.match(/^\s*<([a-zA-Z][a-zA-Z0-9]*)([^>]*)>/);
    if (!tagMatch) {
        return `<div ${BLOCK_ATTR}="${def.id}" ${BLOCK_INSTANCE_ATTR}="${instanceId}" ${BLOCK_CONFIG_ATTR}="${cfgB64}">${body}</div>`;
    }
    const tag = tagMatch[1];
    const existingAttrs = tagMatch[2];
    const opener = `<${tag} ${BLOCK_ATTR}="${def.id}" ${BLOCK_INSTANCE_ATTR}="${instanceId}" ${BLOCK_CONFIG_ATTR}="${cfgB64}"${existingAttrs}>`;
    return body.replace(tagMatch[0], opener);
}
function randomId() {
    return 'b-' + Math.random().toString(36).slice(2, 8);
}
/* ----------------------------- read/update --------------------------- */
function findInstance(source, instanceId) {
    const root = parse(source, { lowerCaseTagName: false, comment: true });
    return root.querySelector(`[${BLOCK_INSTANCE_ATTR}="${instanceId}"]`);
}
/** Pull the JSON config stored on an instance. Returns {} when missing. */
export function readBlockConfig(source, instanceId) {
    const el = findInstance(source, instanceId);
    if (!el)
        return {};
    const raw = el.getAttribute(BLOCK_CONFIG_ATTR);
    if (!raw)
        return {};
    return decodeConfig(raw);
}
/**
 * Re-render an existing block instance from a new config. Returns the new
 * outer HTML string ready to feed into a `set-outer-html` patch (the caller
 * already has the instance's `data-ve-id`).
 */
export function renderBlockUpdate(def, config, instanceId) {
    return renderBlock(def, config, { instanceId });
}
export function createRegistry(defs) {
    const map = new Map(defs.map((d) => [d.id, d]));
    return {
        list: () => Array.from(map.values()),
        get: (id) => map.get(id),
    };
}
/* ----------------------------- starter blocks ------------------------ */
/**
 * Four hand-tuned starter blocks. The templates lean on inline styles so
 * they render the same regardless of the surrounding page's CSS — important
 * because htmlstudio doesn't know the host's design system.
 */
export const BUILTIN_BLOCKS = [
    {
        id: 'hero-split',
        name: 'Hero — Split',
        category: 'hero',
        description: 'Headline + subhead + CTA on the left, image on the right.',
        thumbnail: '🦸',
        template: `
<section style="display:grid;grid-template-columns:1fr 1fr;gap:48px;padding:80px 40px;max-width:1200px;margin:0 auto;align-items:center;font-family:system-ui,sans-serif;">
  <div>
    <h1 ${BLOCK_FIELD_ATTR}="heading" style="font-size:48px;line-height:1.1;margin:0 0 16px;color:#0f172a;">{{heading}}</h1>
    <p ${BLOCK_FIELD_ATTR}="subhead" style="font-size:18px;line-height:1.5;color:#475569;margin:0 0 32px;">{{subhead}}</p>
    <a ${BLOCK_FIELD_ATTR}="cta_text" href="{{cta_href}}" style="display:inline-block;padding:14px 28px;background:{{accent}};color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">{{cta_text}}</a>
  </div>
  <img ${BLOCK_FIELD_ATTR}="image" src="{{image}}" alt="{{image_alt}}" style="width:100%;border-radius:12px;box-shadow:0 12px 32px rgba(0,0,0,0.12);"/>
</section>`.trim(),
        fields: [
            { key: 'heading', type: 'text', label: 'Headline', default: 'Build something people actually use' },
            { key: 'subhead', type: 'textarea', label: 'Sub-headline', default: 'A two-line pitch that earns the click.' },
            { key: 'cta_text', type: 'text', label: 'CTA label', default: 'Get started' },
            { key: 'cta_href', type: 'url', label: 'CTA link', default: '#signup' },
            { key: 'accent', type: 'color', label: 'Accent color', default: '#2563eb' },
            { key: 'image', type: 'image', label: 'Image URL', default: 'https://placehold.co/600x400' },
            { key: 'image_alt', type: 'text', label: 'Image alt text', default: 'product screenshot' },
        ],
    },
    {
        id: 'cta-banner',
        name: 'CTA Banner',
        category: 'cta',
        description: 'Full-width call to action with one button.',
        thumbnail: '📣',
        template: `
<section style="background:{{background}};color:{{text_color}};padding:64px 40px;text-align:center;font-family:system-ui,sans-serif;">
  <h2 ${BLOCK_FIELD_ATTR}="heading" style="font-size:36px;margin:0 0 12px;">{{heading}}</h2>
  <p ${BLOCK_FIELD_ATTR}="subhead" style="font-size:17px;opacity:0.85;margin:0 auto 28px;max-width:560px;line-height:1.5;">{{subhead}}</p>
  <a ${BLOCK_FIELD_ATTR}="cta_text" href="{{cta_href}}" style="display:inline-block;padding:14px 32px;background:{{button_bg}};color:{{button_color}};border-radius:8px;text-decoration:none;font-weight:600;">{{cta_text}}</a>
</section>`.trim(),
        fields: [
            { key: 'heading', type: 'text', label: 'Headline', default: 'Ready when you are' },
            { key: 'subhead', type: 'textarea', label: 'Sub-headline', default: 'Start free. Upgrade only when you need to.' },
            { key: 'cta_text', type: 'text', label: 'Button text', default: 'Start free' },
            { key: 'cta_href', type: 'url', label: 'Button link', default: '#signup' },
            { key: 'background', type: 'color', label: 'Background', default: '#0f172a' },
            { key: 'text_color', type: 'color', label: 'Text color', default: '#ffffff' },
            { key: 'button_bg', type: 'color', label: 'Button background', default: '#ffffff' },
            { key: 'button_color', type: 'color', label: 'Button text color', default: '#0f172a' },
        ],
    },
    {
        id: 'feature-grid-3',
        name: 'Features — 3 columns',
        category: 'list',
        description: 'Three icon-headline-body cards in a row.',
        thumbnail: '🧩',
        template: `
<section style="padding:80px 40px;max-width:1200px;margin:0 auto;font-family:system-ui,sans-serif;">
  <h2 ${BLOCK_FIELD_ATTR}="section_title" style="text-align:center;font-size:32px;margin:0 0 48px;color:#0f172a;">{{section_title}}</h2>
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:32px;">
    <div style="padding:24px;border:1px solid #e2e8f0;border-radius:12px;">
      <div style="font-size:36px;margin-bottom:12px;">{{icon_1}}</div>
      <h3 ${BLOCK_FIELD_ATTR}="title_1" style="margin:0 0 8px;font-size:18px;color:#0f172a;">{{title_1}}</h3>
      <p ${BLOCK_FIELD_ATTR}="body_1" style="margin:0;color:#475569;line-height:1.55;">{{body_1}}</p>
    </div>
    <div style="padding:24px;border:1px solid #e2e8f0;border-radius:12px;">
      <div style="font-size:36px;margin-bottom:12px;">{{icon_2}}</div>
      <h3 ${BLOCK_FIELD_ATTR}="title_2" style="margin:0 0 8px;font-size:18px;color:#0f172a;">{{title_2}}</h3>
      <p ${BLOCK_FIELD_ATTR}="body_2" style="margin:0;color:#475569;line-height:1.55;">{{body_2}}</p>
    </div>
    <div style="padding:24px;border:1px solid #e2e8f0;border-radius:12px;">
      <div style="font-size:36px;margin-bottom:12px;">{{icon_3}}</div>
      <h3 ${BLOCK_FIELD_ATTR}="title_3" style="margin:0 0 8px;font-size:18px;color:#0f172a;">{{title_3}}</h3>
      <p ${BLOCK_FIELD_ATTR}="body_3" style="margin:0;color:#475569;line-height:1.55;">{{body_3}}</p>
    </div>
  </div>
</section>`.trim(),
        fields: [
            { key: 'section_title', type: 'text', label: 'Section title', default: 'Why it works' },
            { key: 'icon_1', type: 'text', label: 'Card 1 icon', default: '⚡' },
            { key: 'title_1', type: 'text', label: 'Card 1 title', default: 'Fast by default' },
            { key: 'body_1', type: 'textarea', label: 'Card 1 body', default: 'Edge-first architecture, sub-100ms page loads.' },
            { key: 'icon_2', type: 'text', label: 'Card 2 icon', default: '🔒' },
            { key: 'title_2', type: 'text', label: 'Card 2 title', default: 'Private by design' },
            { key: 'body_2', type: 'textarea', label: 'Card 2 body', default: 'Your data never leaves your tenancy.' },
            { key: 'icon_3', type: 'text', label: 'Card 3 icon', default: '🤝' },
            { key: 'title_3', type: 'text', label: 'Card 3 title', default: 'Honest pricing' },
            { key: 'body_3', type: 'textarea', label: 'Card 3 body', default: 'Pay for usage, not seats. No surprise invoices.' },
        ],
    },
    {
        id: 'testimonial-quote',
        name: 'Testimonial Quote',
        category: 'social',
        description: 'Single large quote with attribution.',
        thumbnail: '💬',
        template: `
<section style="padding:64px 40px;max-width:840px;margin:0 auto;text-align:center;font-family:system-ui,sans-serif;">
  <p ${BLOCK_FIELD_ATTR}="quote" style="font-size:24px;line-height:1.5;color:#0f172a;margin:0 0 24px;font-style:italic;">"{{quote}}"</p>
  <div style="display:flex;align-items:center;justify-content:center;gap:12px;">
    <img ${BLOCK_FIELD_ATTR}="avatar" src="{{avatar}}" alt="{{name}}" style="width:48px;height:48px;border-radius:9999px;object-fit:cover;"/>
    <div style="text-align:left;">
      <div ${BLOCK_FIELD_ATTR}="name" style="font-weight:600;color:#0f172a;">{{name}}</div>
      <div ${BLOCK_FIELD_ATTR}="role" style="font-size:13px;color:#64748b;">{{role}}</div>
    </div>
  </div>
</section>`.trim(),
        fields: [
            { key: 'quote', type: 'textarea', label: 'Quote', default: 'It paid for itself in the first week — and our designers stopped opening tickets for copy tweaks.' },
            { key: 'name', type: 'text', label: 'Name', default: 'Alex Rivera' },
            { key: 'role', type: 'text', label: 'Role', default: 'Head of Product, Northwind' },
            { key: 'avatar', type: 'image', label: 'Avatar URL', default: 'https://placehold.co/96x96' },
        ],
    },
];
export const BUILTIN_REGISTRY = createRegistry(BUILTIN_BLOCKS);
//# sourceMappingURL=blocks.js.map