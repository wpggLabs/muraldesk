# MuralDesk — Screenshot Checklist

A short, opinionated list of the screenshots that should ship with the repo / submission. Aim for a small, intentional set — not an exhaustive gallery.

All screenshots live under `docs/assets/`. Use the suggested filenames so README links don't drift.

---

## Required set

| # | Filename | What it shows | Caption |
|---|---|---|---|
| 1 | `muraldesk-hero.png` | Branded hero — wordmark + a few floating cards on a dark backdrop. **Already shipped.** | *MuralDesk — local-first visual mural layer for your desktop.* |
| 2 | `01-overlay.png` | MuralDesk's transparent window floating over a normal desktop with a code editor and browser visible behind. | *Transparent overlay — your apps stay visible behind the mural.* |
| 3 | `02-sample-board.png` | Result of clicking **✨ Sample** — images, a looping video, a YouTube embed, notes, web links. | *Sample board — one click to skip the empty state.* |
| 4 | `03-hover-controls.png` | A single card hovered, mini-toolbar visible (opacity · fit · lock · duplicate · delete). | *Hover-only controls — opacity, fit, lock, duplicate, delete.* |
| 5 | `04-smart-embeds.png` | Three smart embeds side by side (e.g. YouTube + Spotify + CodePen). | *Smart embeds — paste any link, MuralDesk picks the right card.* |
| 6 | `05-desktop-mode.png` | Desktop Mode active, overlay covering the entire current display, toolbar tucked at the top. | *Desktop Mode (`Ctrl/Cmd + Shift + D`) — overlay covers the current display.* |
| 7 | `06-click-through.png` | Cursor in an empty area of the overlay, with a tooltip / highlight on a window behind it to prove click-through. | *Click-through — empty regions pass mouse events to the apps underneath.* |
| 8 | `07-backup-export.png` | The downloaded `.muraldesk.json` file in a file manager next to the running app. | *Portable backup — one `.muraldesk.json` file with layout + media.* |
| 9 | `08-windows-app.png` | The installed Windows app running with its branded icon visible in the taskbar / Start menu. | *Windows installer — branded icon, NSIS-packaged `.exe`.* |

---

## Nice-to-have

- `09-multi-monitor-all.png` — Desktop Mode with the **Display** toggle set to **All**, mural spanning two monitors. Only include if you have a multi-monitor setup to capture cleanly.
- `10-focus-mode.png` — A card centered in Focus mode with the dimmed backdrop.
- `11-pwa-install.png` — Chrome install prompt for the PWA, branded icon visible.

---

## What not to show

- ❌ **Broken images.** If a smart embed fails to load on the day of capture, retake — don't ship a broken `<img>`.
- ❌ **Cluttered toolbar.** Make sure the screenshots reflect the polished compact toolbar + **More** menu, not an outdated overflowing row.
- ❌ **Placeholder docs / lorem ipsum** in any visible note card.
- ❌ **Fake multi-monitor claims.** Don't stitch together two single-monitor screenshots and pass it off as the **All** display mode. If you don't have a real multi-monitor setup, omit the screenshot.
- ❌ **Unsigned-installer SmartScreen warning** — unless the screenshot is part of an explicit "first-launch on Windows" walkthrough that explains the warning honestly.
- ❌ **Personal data** — open browser tabs with email subjects, chat sidebars with names, file paths containing your username. Crop or blur before publishing.
- ❌ **Dev-tools panels open**, console errors visible, or HMR overlays — capture the polished build.

---

## Capture settings

- Window size: at least **1280 × 800** for non-overlay shots; **full display** for overlay / Desktop Mode shots.
- Format: **PNG** (lossless, preserves transparency for overlay shots).
- Color: sRGB.
- File size: keep under 500 KB each where possible — re-export if a screenshot blows past that.
- File names: lowercase, hyphenated, prefixed with the order number (`01-…`, `02-…`).

## Adding new screenshots to the README

When adding a new image to the README:

1. Drop the file in `docs/assets/`.
2. Reference it as `docs/assets/<filename>.png`.
3. Set an explicit `width="…"` so GitHub doesn't render a 4 K image at 1:1.
4. Always supply a real `alt` attribute that describes the image for screen readers — never `alt=""`.
