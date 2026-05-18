---
name: pricing-page
description: Standalone pricing + comparison page with tier cards and an itemized feature table.
metadata:
  mode: prototype
  platform: responsive_web
  scenario: sale
  default_for: ["pricing", "plans", "pricing page", "tiers"]
  example_prompt: "A 3-tier SaaS pricing page with monthly/annual toggle and feature comparison"
  design_system_required: false
---

# Pricing page

A single-page pricing surface, designed for a buyer who is comparison shopping.

## Required sections

1. **Sticky nav** (lightweight — link back to product is enough).
2. **Headline + monthly/annual toggle.** Annual should show a "save 20%" badge (or whatever the brief says).
3. **3-4 plan cards** in a row on desktop, stacked on mobile. Each card has:
   - Plan name
   - One-line "for whom" subtitle
   - Price (large, with /mo or /yr unit)
   - Primary CTA
   - 5-8 bullet features. Mark the middle/recommended plan with a subtle badge ("Most popular") and slightly elevated style.
4. **Feature comparison table** — full matrix of every feature × every plan. Checkmarks / dashes / value cells. Sticky first column on mobile.
5. **FAQ** — 6-10 concise Q&A. Use `<details>` for accessibility (no JS required).
6. **Footer CTA** — final "Start free" or "Talk to sales" block.

## Quality rules
- Tabular numerics (`font-variant-numeric: tabular-nums`) on every price.
- Comparison table must be readable at 360px (horizontal scroll inside a fixed wrapper is acceptable).
- "Contact sales" plan: replace the price slot with "Custom" and a "Talk to us" CTA, not "$$$".
- No fake discount strikethrough numbers unless the brief specifies them.
