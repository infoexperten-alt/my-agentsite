---
name: portfolio
description: Personal or studio portfolio — bold typographic intro, project grid, case-study links, contact.
metadata:
  mode: prototype
  platform: responsive_web
  scenario: marketing
  default_for: ["portfolio", "personal site", "studio site", "agency site"]
  example_prompt: "A portfolio site for a freelance product designer focused on fintech work"
  design_system_required: false
---

# Portfolio site

A personal or studio site whose job is to make the visitor say "I want to work with this person."

## Required surfaces

1. **Slim nav** — name/wordmark, 3-4 links (Work / About / Writing / Contact).
2. **Intro** — large typographic statement (clamp() display size). One sentence of who-what-for, plus a thin metadata strip (location, availability, current role).
3. **Project grid** — 4-9 case-study cards. Each card: cover image / colored block, project title, one-line role, year. Hover state lifts subtly. Click goes to a (mocked) case-study URL.
4. **About** — short bio paragraph + photo OR signature mark.
5. **Selected clients / press** — restrained logo strip OR list. Skip the section entirely if there isn't real material.
6. **Contact** — email (mailto), maybe Twitter/LinkedIn, calendar booking link.

## Quality rules
- One decisive type voice. If display is serif, body is sans (or vice versa).
- Project cards: real names + roles. Use labelled placeholders ("[Cover image — replace with hero shot]") not Lorem ipsum titles.
- No carousels. No parallax. No autoplay video.
- Empty / "more soon" states are honest. Don't pad the grid with fake projects.
