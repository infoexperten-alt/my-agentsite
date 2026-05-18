---
name: blog-post
description: Long-form editorial article — opinionated typography, byline, hero image, generous reading column.
metadata:
  mode: prototype
  platform: responsive_web
  scenario: editorial
  default_for: ["blog post", "article", "essay", "post"]
  example_prompt: "A blog post about why we rewrote our build pipeline, with code examples and a hero image"
  design_system_required: false
---

# Blog post / long-form article

Editorial mode. Lean into typography — a great post is mostly text, set well.

## Required surfaces

1. **Slim topbar** — logo + 3-4 nav links. No marketing CTAs in the chrome.
2. **Article header** — kicker / category (mono uppercase), headline, optional deck/sub-headline, byline (author + date + read-time), one hero image OR a colored block.
3. **Body** — single column, 65-75ch, generous leading. `<h2>` / `<h3>` rhythm; blockquotes set with a left rule, no italics; code blocks if it's a tech post.
4. **Pull quote** — at least one, set large with the accent color.
5. **Footer** — author bio card (photo + 1-2 lines + links), social share buttons (no third-party widgets — use mailto / X / LinkedIn intents), 3 "you might also like" cards.

## Quality rules
- Display font = serif OR a strong sans with weight contrast (matches StyleSpec).
- Body font ≠ display font (the only exception is the tech-utility direction).
- No floating share bars unless the brief asks; sticky footer-attached is fine.
- Real headline + 3-5 real paragraphs of body — never lorem ipsum.
- Images: full-bleed wide or breakout-width within the column, never tiny inline thumbnails.
