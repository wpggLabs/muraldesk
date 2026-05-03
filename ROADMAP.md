# MuralDesk — Roadmap

The roadmap is intentionally short. MuralDesk's value is in being a quiet, local-first mural layer; growth means more *muralness*, not more app surface.

Items are grouped by intent, not by sprint. Anything not listed here is explicitly out of scope.

---

## Near-term (the next thing to build)

- **Per-monitor overlay windows / independent boards per monitor.**
  Today: one MuralDesk window. Drag it to a monitor and it covers that monitor; the **All** display mode spans every monitor as one big canvas.
  Goal: run a *separate* MuralDesk board on each monitor (e.g. references on monitor 1, todo on monitor 2) with independent state and persistence per display.

- **Drag-and-drop ingestion.**
  Drop image / video files or URL chunks anywhere on the canvas to add them, instead of going through the toolbar.

- **Snap guides + richer layout tools.**
  Smart alignment guides while dragging (already partial), distribute / equalize spacing, group selection.

- **Startup options + tray polish.**
  Launch-on-startup with explicit *start in tray* and *start in Desktop Mode* flags; richer tray menu (recent boards, quick toggles).

---

## Mid-term (logical extensions)

- **Board organization.** Groups, tags, search, multiple named boards within one app instance.

- **More embed providers.** Whatever passes the safety contract (strict host allow-list + ID/slug regex). Candidates: Bandcamp, Twitch clips, Loom, Figma, Miro embeds.

- **Template boards.** A small library of starting points (mood board, sprint wall, watch-later, research scratchpad).

- **Linux & macOS installers.** Windows is the primary packaging target today; AppImage / DMG / Flatpak come next.

---

## Exploratory (research, not commitments)

- **Wallpaper-layer experiments — Windows-first.**
  Investigate drawing the mural *under* desktop icons rather than as a transparent overlay on top, à la Wallpaper Engine. This is a real OS-shell-integration project, not a small change. Listed as exploratory, not promised.

- **Stylus / pen-friendly note input** for tablet PCs.

---

## Way out (only if the right reason appears)

- **Optional sync / sharing.**
  Strictly opt-in; the app stays local-first by default. Likely shape: encrypted blob to a user-supplied storage backend (S3-compatible, WebDAV, etc.), not a MuralDesk-hosted cloud. No accounts.

- **Mobile companion** for capture-and-add (drop a photo from your phone onto the desktop board). Only if there's a clean way to do it without a backend.

---

## Explicitly **not** on the roadmap

These are intentional non-goals — saying no preserves the product:

- ❌ User accounts / login.
- ❌ MuralDesk-hosted cloud storage.
- ❌ Telemetry, analytics, or any phone-home behavior.
- ❌ A backend service the desktop client depends on.
- ❌ Social features (likes, follows, public boards).
- ❌ A plugin marketplace.
- ❌ Generative AI inside the app.
- ❌ Becoming a generic notes app, browser bookmark manager, or screenshot tool.

---

## How to suggest something

Open an issue with the use case first, the proposed change second. The bar is high: does it make MuralDesk *more* of a quiet local-first mural layer, or does it pull it toward being a generic productivity app? The former gets considered; the latter doesn't.
