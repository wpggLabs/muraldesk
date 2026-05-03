# MuralDesk — Product Brief

A short, honest statement of what MuralDesk is, who it's for, and where its limits are.

---

## Vision

A quiet, local-first **mural layer** for the desktop. References, inspiration, and ambient media live on a transparent overlay that floats *next to* the work — not on top of it, not in another tab, not in another app to alt-tab into.

The product succeeds when users stop noticing it's there and just glance at it.

---

## Target users

MuralDesk is for people who already collect visual material and have nowhere quiet to put it.

- **Developers** — pinning API docs, screenshots of bugs, reference UIs, and a looping demo clip while working.
- **Designers** — moodboards, color palettes, type specimens, reference videos, client links.
- **Researchers** — a wall of screenshots, paper figures, tab snapshots, and quote notes for a project.
- **Streamers** — chat overlays, scene references, asset previews, looping highlight clips.
- **Students** — lecture-slide screenshots, formula notes, reference videos, focus-mode flashcards.
- **Anyone keeping a moodboard or reference board** — film stills, photography references, fashion, architecture, recipes, plant care.

The common thread: visual material that's **glanceable, ambient, persistent, and personal** — not collaborative-team content.

---

## Use cases

- Keep a small set of design references **always visible** while working in another app.
- Park a **looping reference video** (a UI animation, a guitar lick, a knife-skill clip) in the corner of the screen.
- Pin **YouTube / Spotify / SoundCloud / CodePen** embeds you actually use, instead of leaving 30 tabs open.
- Build a **moodboard** that survives a reboot and doesn't live in a tab.
- Drop screenshots into a **bug-investigation wall**, then Backup the whole thing as evidence.
- Use **Desktop Mode** for a focus session — the entire screen becomes the mural.

---

## Core value proposition

> A real, persistent visual layer for your desktop — without an account, without a cloud, without a backend.

Three components do the heavy lifting:

1. **Transparent click-through overlay.** Cards stay clickable; empty space passes mouse events to the apps underneath. The overlay feels like part of the OS, not a window on top of it.
2. **Smart embeds + safe link handling.** Paste any URL; MuralDesk picks the right card. Unsafe protocols are blocked before a card is ever created.
3. **Local-first persistence + portable backup.** Layout in `localStorage`, media in IndexedDB, one-click portable `.muraldesk.json` for cross-machine moves.

---

## Differentiators

- **Truly transparent + click-through, cross-platform.** Not a fake-transparent opaque window. Real OS-level transparency, plus a renderer-side hit-test that flips `setIgnoreMouseEvents` per cursor position. Same behavior on Windows, macOS, and Linux.
- **Local-first without compromise.** No accounts, no telemetry. Cross-machine portability is solved by an explicit single-file backup, not by a cloud.
- **Ambient-first UX.** Hover-only mini-toolbars, opacity sliders, looping muted videos by default, an Interact toggle on embeds. Designed to fade into the background.
- **Strict link safety.** Per-provider host allow-lists, strict ID/slug regex for every embed, protocol whitelist (`http(s)` only) enforced on paste *and* on import.
- **Tiny.** ~80 KB gzipped renderer; four runtime dependencies (`react`, `react-dom`, `react-rnd`, `uuid`).
- **Runs as both a desktop app and a PWA.** Same board, same shortcuts, same files.

---

## MVP scope (what's in the buildathon build)

- Add / move / resize / lock / duplicate / delete cards.
- Image, video, note, and link cards.
- Smart embeds: YouTube, Vimeo, SoundCloud, Spotify, CodePen, direct video URLs, direct image URLs, generic web link previews.
- Local-first storage: `localStorage` for layout, IndexedDB for media blobs.
- Portable `.muraldesk.json` backup with embedded media; layout-only Export; auto-detecting Import.
- Electron transparent overlay with click-through and a system tray.
- Desktop Mode covering the **current** display, plus an **All-displays** mode that spans every monitor.
- Tidy (shelf-pack), Focus (centered card), Snap (24 px grid), board opacity, theme, accent.
- Compact toolbar with a **More** menu, in-app keyboard-shortcuts modal, sample board, empty state.
- PWA install with a branded icon set; offline app shell via service worker.
- Branded **Vastago** wordmark loaded locally — no third-party font CDN.

---

## Current limitations

- **Not a full wallpaper engine.** The overlay is a transparent window drawn *on top of* the desktop, not a true OS shell layer drawn *under* desktop icons.
- **Multi-monitor is single-window.** Current-display and all-displays modes ship today; **independent boards per monitor are not available yet** — that's roadmap.
- **Windows installer is unsigned**, so SmartScreen warns first-time users.
- **Electron desktop must be tested on a real desktop OS.** Replit's container lacks the GUI / GTK / Chromium libraries Electron needs at runtime; only the web / PWA preview runs on Replit.
- **No cloud sync, by design.** Backup is a manual, explicit step.
- **Web-version media is per-browser-profile** (IndexedDB is per-origin / per-profile).
- **Some link previews depend on the target site** — pages that block embedding via `X-Frame-Options` / CSP fall back to favicon + title cards.

---

## Non-goals

See [`ROADMAP.md`](ROADMAP.md) for the full list. Short version: no accounts, no MuralDesk-hosted cloud, no telemetry, no required backend, no social features, no plugin marketplace, no in-app generative AI. MuralDesk stays a quiet local mural layer.
