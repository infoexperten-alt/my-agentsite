# htmlstudio

> HTML-source-of-truth visual editor primitives. Built to power [AgentSite](https://github.com/jhd3197/AgentSite) — the "edit after the agent ships it" layer for AI-generated websites.

[![CI](https://github.com/jhd3197/htmlstudio/actions/workflows/ci.yml/badge.svg)](https://github.com/jhd3197/htmlstudio/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## Why

AgentSite's PM → Designer → Developer → Reviewer pipeline produces real HTML/CSS/JS files. Once they're generated, users want to nudge them — change a headline, swap an image, tweak a color — without spinning the whole agent loop back up. htmlstudio is that nudge layer. The HTML the agents emit stays the source of truth; every visual edit is a tiny, typed patch on that string — the same shape an LLM tool-call would emit, so the agents and the human edit through the same channel.

Light inspiration from GrapesJS (the inspector-panel mental model) and open-design's `edit-mode` bridge (source-mapped `data-*` ids + `postMessage` round-trip), but htmlstudio is intentionally small and scoped — no scene graph, no plugin runtime, no block library to maintain. Just the three primitives AgentSite needs.

Three primitives, ~400 LOC of source:

| Primitive | What it does |
|---|---|
| **`tagHtml(html)`** | Walks the tree, stamps stable `data-ve-id="p-0-1-2"` ids on every meaningful element. Idempotent. |
| **`buildBridgeScript(opts)` / `injectBridge(html, opts)`** | A `<script>` you inject into a preview iframe. Handles hover outlines, click-to-select, `contenteditable` double-click-to-edit, and `postMessage`s typed events to the host. |
| **`applyPatch(source, patch)`** | Six patch kinds: `set-text`, `set-link`, `set-image`, `set-style`, `set-attributes`, `set-outer-html`, `set-full-source`. Mutates by id, returns new source. |

## Pipeline

```
 AI emits HTML
      │
      ▼
  tagHtml ─────► HTML + data-ve-id="p-0-1-2" on each element
      │
      ▼
 injectBridge ─► same HTML + bridge <script> before </body>
      │
      ▼
 preview iframe renders it; user hovers / clicks / dblclicks
      │
      ▼  (postMessage, channel: 've')
 host receives BridgeEvent { type: 'select' | 'dblclick-text' | ... }
      │
      ▼
 host builds a Patch; applyPatch(source, patch)
      │
      ▼
 new source string ─► save to DB / re-render iframe
```

## Install

```bash
npm install htmlstudio
```

## Quick start

```ts
import { tagHtml, injectBridge, applyPatch } from 'htmlstudio';

const raw = '<section><h1>Hello</h1><p>world</p></section>';
const tagged = tagHtml(raw);
// <section data-ve-id="p-0"><h1 data-ve-id="p-0-0">Hello</h1><p data-ve-id="p-0-1">world</p></section>

const previewHtml = injectBridge(`<!doctype html><body>${tagged}</body>`, {
  targetOrigin: 'https://your-host.app',
});
// → serve this in the iframe

// when the user edits a text node:
const r = applyPatch(tagged, { kind: 'set-text', id: 'p-0-0', value: 'Hi there' });
console.log(r.source); // updated HTML, ready to persist
```

## Host-side wiring

```js
window.addEventListener('message', (e) => {
  if (e.data?.channel !== 've') return;
  switch (e.data.type) {
    case 'ready':         console.log(`${e.data.payload.count} elements tagged`); break;
    case 'hover':         /* show breadcrumb */ break;
    case 'select':        /* render inspector panel */ break;
    case 'dblclick-text': /* user finished inline editing; build a set-text patch */ break;
  }
});

// host → iframe commands
iframe.contentWindow.postMessage(
  { channel: 've', type: 'highlight', payload: { id: 'p-0-1' } },
  'https://preview.app',
);
```

## Patch types

```ts
type Patch =
  | { kind: 'set-text';        id: string; value: string }
  | { kind: 'set-link';        id: string; href: string; text: string }
  | { kind: 'set-image';       id: string; src: string; alt: string }
  | { kind: 'set-style';       id: string; styles: Record<string, string> }   // '' removes
  | { kind: 'set-attributes';  id: string; attributes: Record<string, string | null> } // null removes
  | { kind: 'set-outer-html';  id: string; html: string }                     // id slot preserved
  | { kind: 'set-full-source'; source: string };
```

## Demo

```bash
npm install
npm run build
npm run demo
# → http://127.0.0.1:5180
```

Two-pane host: live iframe preview on the left, inspector + event log on the right. Click any element, double-click text to edit inline, or tweak fields in the inspector.

## Develop

```bash
npm install
npm run build         # tsc → dist/
npm test              # vitest, 25 tests
npm run test:watch
npm run dev           # tsc --watch
```

## Design principles

- **Source = HTML.** No proprietary scene graph, no schema migrations, no lossy import/export. The string the agent writes is the string the editor mutates.
- **Agent-native.** Every patch maps 1:1 to an LLM tool-call, so AgentSite's agents and a human user edit through the exact same surface.
- **Tiny and boring.** One runtime dep (`node-html-parser`). Bridge script is ~3 KB unminified. Pure TS core.
- **Not a website builder.** It's a primitives layer. AgentSite owns the surfaces (chat, pipeline, generation); htmlstudio owns "click a thing → change a thing → patch the source."

## Roadmap

- `htmlstudio-react` — `<HtmlStudio source onChange />` + inspector components.
- Block/component registry via `data-ve-block="hero"`.
- Undo/redo stack helper.
- Style-token patches (`set-token`) for design-system-aware editing.
- AI tool-call adapter (`patchToToolCall` / `toolCallToPatch`).

## License

MIT © Juan Denis
