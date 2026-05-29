---
name: dashboard
description: Internal tool / analytics dashboard — sidebar nav, KPI cards, charts placeholder, a data table.
metadata:
  mode: prototype
  platform: desktop_web
  scenario: app
  default_for: ["dashboard", "admin panel", "internal tool", "ops console"]
  example_prompt: "An analytics dashboard for a billing ops team — MRR, churn, latest invoices"
  design_system_required: false
---

# Dashboard / tool UI

Information density is the feature, not vibes. You are a systems designer here, not a brand designer.

## Required surfaces

1. **Sidebar nav** — 240px wide, icons + labels, current section highlighted. Sections grouped (Overview / Reports / Settings).
2. **Topbar** — workspace name, search, notifications, account menu.
3. **Header row** — page title + breadcrumbs on the left; primary action (e.g. "Export") on the right.
4. **4 KPI cards** in a row — large number, label, delta vs last period (green/red). Tabular numerics, mono for IDs/hashes.
5. **Main visual area** — one large chart placeholder (SVG with grid lines + labelled mock data is fine) OR a heatmap grid OR a multi-line area.
6. **Data table** — sortable column headers, hairline row borders (no zebra striping), pagination at the bottom. Include status pills (success / warn / danger) with restrained tinted backgrounds.
7. **Empty / loading / error states** — at least one of them should be visible (e.g. a banner or a placeholder row).

## Quality rules
- No marketing copy. No oversized headlines. No hero images.
- Hairline borders only (1px), no shadows except on dropdowns/modals.
- Inline status pills, never giant alert banners for routine signals.
- Sidebar collapses to icon-only at <1024px; full-screen drawer at <768px.
- Avoid warm beige / peach backgrounds — neutral surface, brand accent for one signal color only.
