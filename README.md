<div align="center">

<img src="public/icon.svg" alt="MuralDesk" width="112" height="112" />

# MuralDesk

**A local-first visual mural layer for your desktop.**
Pin images, videos, links, and notes onto a transparent overlay that floats over your real workspace.

[![Electron](https://img.shields.io/badge/Electron-31-2B2E3A?logo=electron&logoColor=9FEAF9)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-18-20232A?logo=react&logoColor=61DAFB)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-5-1B1B20?logo=vite&logoColor=FFD028)](https://vitejs.dev/)
[![PWA](https://img.shields.io/badge/PWA-installable-5A0FC8?logo=pwa&logoColor=white)](https://web.dev/progressive-web-apps/)
[![License: MIT](https://img.shields.io/badge/License-MIT-22A06B.svg)](LICENSE)

</div>

---

## What it is

MuralDesk is a desktop visual mural app. You drop **images, videos, YouTube links, direct media links, web links, and sticky notes** onto a clean transparent canvas that floats over your real desktop. Cards are draggable and resizable; empty space clicks straight through to the apps underneath.

It also runs as a standard **Progressive Web App** in any modern browser, installable on Chrome, Edge, and Safari.

## Why it exists

People keep visual references in messy browser tabs, scattered desktop folders, screenshots dumped to `~/Downloads`, second monitors parked on Pinterest, and Slack DMs to themselves.

MuralDesk gives them a quiet local-first wall to pin those references to — *next to* the work, not on top of it.

---

## Features

### Desktop overlay

- Transparent, frameless, no shadow — only the cards render.
- Click-through empty areas pass mouse events to the OS.
- Items stay fully interactive (drag, resize, hover controls).
- Full-display **Desktop Mode** with auto-hiding toolbar.
- System tray with Show / Toggle Desktop Mode / Quit.

### Content types

| Type | Behavior |
|---|---|
| **Image** | Local file or direct URL → resizable image card. |
| **Video** | Local file or direct URL → silent looping clip with hover-only controls. |
| **YouTube** | Auto-detected URL → embedded player, looped and muted by default. |
| **Web link** | Any other URL → favicon + title card with **Open** button. |
| **Note** | Editable text card with a small color palette. |

### Editing

- Drag and resize anywhere on the canvas.
- Hover any card for a compact mini-toolbar:
  opacity slider · fit toggle (cover / contain) · lock · duplicate · delete.
- One-click **Sample Board** to skip the empty state.
- Keyboard shortcuts: `Ctrl/Cmd+Shift+I` / `V` / `L` / `T` / `F` for image / video / link / toolbar / fullscreen.

### Local-first storage

- **No account. No backend. No cloud.**
- Layout in `localStorage`, media blobs in IndexedDB.
- One-click **Backup** exports a single portable `.muraldesk.json` file (layout + base64-inlined media).
- **Import** auto-detects backup vs. layout-only files.

---

## Desktop Mode

The Electron build is where MuralDesk earns its name.

- The window itself is transparent — the OS desktop and your other apps show through unchanged.
- A renderer-side hit-test flips click-through on the fly: cards stay clickable, empty regions don't capture mouse events.
- Pressing `Ctrl/Cmd+Shift+F` (or the toolbar button) expands the overlay to cover the current display, using window bounds rather than OS-level fullscreen, so cards can move freely across the whole screen.
- The toolbar tucks into a thin reveal-zone at the top — bring the cursor up to show it again.

---

## Smart link behavior

A single Add Link input becomes four different card types based on URL parsing — no per-source picker, no manual toggles.

- **YouTube URLs** → embedded playable card (`youtube-nocookie.com`).
- **Direct image URLs** (`.png`, `.jpg`, `.gif`, `.webp`, `.svg`) → image card.
- **Direct video URLs** (`.mp4`, `.webm`, `.mov`, `.ogg`) → playable video card.
- **Anything else** → web link card with favicon, title, and an **Open** button.

> **Safety.** Anything that isn't `http:` or `https:` (e.g. `javascript:`, `data:`, `file:`) is stripped before a card is ever created — both on paste and on backup import.

---

## Tech stack

| Layer | Choice |
|---|---|
| Renderer | React 18 · Vite 5 |
| Drag / resize | `react-rnd` |
| Desktop shell | Electron 31 |
| Persistence | `localStorage` (layout) · IndexedDB (blobs) |
| PWA | Hand-rolled `manifest.webmanifest` + service worker |

No backend. No auth. No analytics. No proprietary services.

---

## Getting started

> The Electron desktop build needs a real desktop OS (Windows, macOS, or Linux). It can't run inside Replit's container, which lacks the GUI / GTK / Chromium libraries Electron needs at runtime. The web / PWA build runs anywhere.

#### Web (development)

```bash
npm install
npm run dev:web
```

Vite serves the renderer on `http://localhost:5000`.

#### Desktop (development)

```bash
npm install
npm run dev:desktop
```

Spins up a dedicated Vite instance on `http://localhost:5173` and launches Electron pointed at it. Hot-reload works for renderer code; main-process changes need a manual restart.

#### Web (production build)

```bash
npm run build:web
```

Outputs a static site to `dist/`. Serve it with any static host.

---

## Build the Windows app

```bash
npm run build:desktop
```

Produces:

```
release/MuralDesk-Setup-0.1.0.exe   ← NSIS installer
release/win-unpacked/MuralDesk.exe  ← unpacked binary
```

For a folder build with no installer (quick smoke test):

```bash
npm run build:desktop:dir
```

The installer is unsigned by default — see Limitations below.

---

## Demo flow

1. Launch MuralDesk.
2. Click **Sample** in the toolbar to load a pre-arranged board.
3. Add an image, video, note, and link of your own.
4. Drag and resize cards across the desktop. Hover one and drop its opacity to ~40%.
5. Paste a YouTube URL — it auto-becomes an embedded player. Toggle interact-mode to seek and unmute.
6. Click an empty region to confirm it passes through to whatever's behind MuralDesk.
7. Press `Ctrl/Cmd+Shift+F` to enter Desktop Mode.
8. Click **Backup** to export a single portable `.muraldesk.json` file.
9. Refresh — everything persists. No upload happened.

---

## Current limitations

- **Not a full wallpaper engine.** The overlay is a transparent window drawn *on top of* the desktop, not a layer drawn *under* desktop icons by the OS shell. Working on identical primitives across Windows, macOS, and Linux was the priority.
- **Unsigned Windows installer.** First-time launchers see SmartScreen and have to click *More info → Run anyway*. Code signing requires a paid certificate.
- **Desktop builds need a real desktop OS.** Replit can't run Electron — use Windows, macOS, or Linux for `dev:desktop` and `build:desktop`.
- **Multi-monitor support is basic.** The window remembers its position and reopens on the right monitor; Desktop Mode covers the current display only.
- **No cloud sync.** Backup is a manual, explicit step. Adding cloud sync would compromise the local-first promise.
- **Web-version media is per-browser-profile.** IndexedDB is per-origin / per-profile. Use Backup to move between browsers.
- **Some link previews depend on the target site.** Sites that block embedding via `X-Frame-Options` or `Content-Security-Policy` fall back to a favicon + title card.

---

## Roadmap

- Per-monitor overlay windows
- Snap guides and soft grid
- Board-level opacity / focus controls
- Launch on startup (with start-in-tray and start-in-Desktop-Mode flags)
- Theme controls (light / dark / custom accent)
- More embed types (Vimeo, SoundCloud, Spotify, CodePen)
- Wallpaper-layer experiments (Windows-first)

---

## License

Released under the MIT License — see [LICENSE](LICENSE).
