---
name: mobile-app
description: Single mobile app screen rendered inside a real device frame (iPhone or Pixel).
metadata:
  mode: prototype
  platform: ios
  scenario: app
  default_for: ["mobile app", "app screen", "ios screen", "android screen"]
  example_prompt: "A mobile app screen for a habit-tracking app's home view"
  design_system_required: false
---

# Mobile app screen

A single screen of a mobile app, rendered inside a pixel-accurate device frame. You are an interaction designer here.

## Required structure

1. **Device chrome** — iPhone 15 Pro frame (390x844) by default: Dynamic Island, status bar (time/signal/battery as SVGs), home indicator. If the brief says Android, switch to Pixel chrome with punch-hole + nav bar.
2. **Status bar content** — accurate-looking time, signal, battery (these are part of the chrome, not the app).
3. **App canvas** — fills the safe area between Dynamic Island and home indicator. Inside the canvas:
   - **Header** — title or context, optional back button on the left, optional action on the right.
   - **Main content** — list, feed, form, map, etc., per the brief.
   - **Bottom navigation** OR **bottom action** — iOS uses tab bar above the home indicator; Android uses bottom nav above the nav bar.
4. **One realistic interaction state** — a button hover/active, a toast, a swipe affordance, a modal sheet partially up. Make it look alive, not static.

## Quality rules
- Hit targets ≥ 44pt (iOS) / 48dp (Android).
- No web-style hover states.
- Real content — recipe names, contact names, transaction amounts — not placeholders.
- Type scale: 17pt body (iOS) / 14sp body (Android). Headers ≥ 22pt.
- Single screen only. If the brief asks for a flow, use the multi-screen pattern (separate `screens/*.html` rendered into shared frames).
