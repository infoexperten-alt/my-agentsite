# Device frames

Vector device chrome rendered as overlays around the preview iframe. Ported
in spirit from Open Design's HTML-based frames; AgentSite uses SVG because
they scale cleanly inside React layouts.

Each frame is defined in its viewBox's pixel space. The preview iframe is
positioned absolutely inside the frame's screen safe area by `DeviceFrame.jsx`:

- `iphone-15-pro.svg` — 390 × 844, Dynamic Island, screen at (14, 14) → (376, 830)
- `android-pixel.svg` — 412 × 900, punch-hole, screen at (14, 14) → (398, 886)
- `ipad-pro.svg` — 834 × 1194, screen at (28, 28) → (806, 1166)
- `macbook.svg` — 1440 × 940, notch + chin, screen at (60, 40) → (1380, 840)

To add a frame: drop a new SVG here and add an entry in
`frontend/src/components/builder/DeviceFrame.jsx`'s `FRAMES` map with the
screen-rect coordinates.
