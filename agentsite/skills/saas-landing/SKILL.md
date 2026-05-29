---
name: saas-landing
description: Marketing landing page for a SaaS product — hero, social proof, features, pricing teaser, CTA.
metadata:
  mode: prototype
  platform: responsive_web
  scenario: marketing
  default_for: ["landing", "homepage", "marketing site", "product page"]
  example_prompt: "A landing page for a B2B AI customer-support tool"
  design_system_required: false
---

# SaaS landing page

You are building a single landing page for a SaaS product. Aim for marketing-grade, not template-grade.

## Required sections (in this order)

1. **Sticky nav** — logo, 3-5 product/solutions/pricing/docs/login links, primary CTA on the right.
2. **Hero** — one short benefit headline (≤ 10 words), one sub-headline (≤ 20 words), primary CTA + secondary CTA, one product visual (screenshot, illustration, or labelled placeholder — not a stock photo of people).
3. **Social proof** — logo strip (4-6 customers) OR a numerical metric strip ("12,000 teams shipping with us"). Use a labelled placeholder if no real logos.
4. **Feature grid** — 3-6 specific features with concrete benefits. No generic icons (no ✨ 🚀).
5. **One deep-dive section** — pick the most differentiating feature and show it with a wide visual + 2-3 supporting bullets.
6. **Testimonial / case study** — one strong quote with attribution OR a mini case study with one metric.
7. **Pricing teaser** — 3 plan cards OR a single CTA to /pricing.
8. **Footer** — multi-column with product / company / resources / legal.

## Quality rules
- One decisive accent color, used at most twice on a single screen.
- Copy must be specific to the prompt — no "Feature One / Feature Two", no "Welcome to our website".
- All images either real (asset library), labelled placeholders, or generated via `generate_image` — never stock photo URLs that could break.
- Mobile-first: works at 360px without horizontal scroll.
- A visible primary CTA above the fold.
