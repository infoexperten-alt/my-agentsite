---
name: docs-page
description: Technical documentation page — sidebar TOC, in-page anchor TOC, prose with code blocks.
metadata:
  mode: prototype
  platform: responsive_web
  scenario: docs
  default_for: ["docs", "documentation", "api docs", "guide", "tutorial"]
  example_prompt: "A docs page for an SDK's quickstart guide with code samples in Python and TS"
  design_system_required: false
---

# Documentation page

Optimized for scan-reading and quick orientation, not marketing.

## Required surfaces

1. **Sticky topbar** — product/docs switcher, search, version selector, GitHub link.
2. **Left sidebar TOC** — categorized list of pages. Current section + page highlighted. Collapsible groups.
3. **Center column** — prose, 65-75ch max-width. Generous line-height (1.6-1.7).
4. **Right sidebar in-page anchor TOC** — auto-generated from `<h2>` / `<h3>` headings. Sticky.
5. **Code blocks** — language-tagged, copy-button, line numbers optional. Mono font, dark on light or vice versa per the StyleSpec.
6. **Inline callouts** — Note / Warning / Tip blocks with left border + icon + tinted background.
7. **"Next / Previous" footer** — links to the surrounding pages in the sidebar order.

## Quality rules
- Code samples must be syntactically correct and complete (no `…` ellipses unless explaining a contract).
- Tables for parameter docs: name | type | default | description.
- Always show one fully-worked example before the API reference.
- Mobile (<768px): collapse left TOC into a drawer behind a hamburger, hide the right anchor TOC entirely.
- Body sans, code mono — no monospace for prose.
