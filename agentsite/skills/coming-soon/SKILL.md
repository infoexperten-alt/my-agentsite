---
name: coming-soon
description: Single-page coming-soon / waitlist page with email capture and one decisive piece of art.
metadata:
  mode: prototype
  platform: responsive_web
  scenario: marketing
  default_for: ["coming soon", "waitlist", "teaser", "launch page", "landing teaser"]
  example_prompt: "A coming-soon page for a developer-tool startup with an email waitlist"
  design_system_required: false
---

# Coming-soon page

A single screen whose job is to capture an email address. Nothing else.

## Required surfaces

1. **Logo / wordmark** — top-left or centered.
2. **One headline** — what is launching. ≤ 8 words.
3. **One sub-headline** — what it is for + when. ≤ 25 words.
4. **One decisive visual** — a colored block, a typographic flourish, one generated illustration, or a clean countdown. Pick ONE — not all of them.
5. **Email capture** — inline form: email input + "Join waitlist" button. On submit show a success message (client-side state, no actual backend). Include privacy line below.
6. **Footer line** — copyright, optional social, optional press email.

## Quality rules
- No nav. No links to "other pages". No FAQ. The whole point is the email field.
- The email input must autofocus on desktop.
- Success state must be obviously different (color or layout shift), not a tiny grey toast.
- Real launch wording — never "Coming soon" + Lorem ipsum.
- Works at 360px with the visual stacking above the form.
