<div align="center">

<img src="public/icon.svg" alt="MuralDesk" width="120" height="120" />

# MuralDesk

#### A local-first visual mural layer for your desktop.

[![Electron 31](https://img.shields.io/badge/Electron-31-2B2E3A?logo=electron&logoColor=9FEAF9&style=flat-square)](https://www.electronjs.org/)
[![React 18](https://img.shields.io/badge/React-18-20232A?logo=react&logoColor=61DAFB&style=flat-square)](https://react.dev/)
[![Vite 5](https://img.shields.io/badge/Vite-5-1B1B20?logo=vite&logoColor=FFD028&style=flat-square)](https://vitejs.dev/)
[![Local-first](https://img.shields.io/badge/Local--first-✓-22A06B?style=flat-square)](#local-first-storage)
[![License: MIT](https://img.shields.io/badge/License-MIT-22A06B?style=flat-square)](LICENSE)

<br />

<img src="docs/assets/muraldesk-hero.png" alt="MuralDesk — local-first visual mural layer for your desktop" width="820" />

<br /><br />

<sub>
  <a href="#core-features">Features</a> ·
  <a href="#desktop-mode">Desktop Mode</a> ·
  <a href="#smart-link-behavior">Smart Embeds</a> ·
  <a href="#run-locally">Install</a> ·
  <a href="#demo-flow">Demo</a> ·
  <a href="#roadmap">Roadmap</a>
</sub>

</div>

---

## What is MuralDesk?

MuralDesk is a desktop **mural layer**. You drop images, videos, smart embeds, links, and notes onto a transparent overlay that floats over your real workspace. Cards stay fully interactive — drag, resize, hover controls — while empty space clicks through to whatever's underneath.

It also runs as a clean **Progressive Web App** in any modern browser. Same board, same shortcuts, same files.

## Why it exists

Visual references end up scattered across browser tabs, screenshot folders, second monitors parked on Pinterest, and Slack DMs to yourself.

MuralDesk gives them one quiet wall — pinned *next to* the work, not on top of it. No account, no cloud, no analytics.

---

## Core features

### Desktop overlay
- Transparent, frameless Electron window — only the cards are drawn.
- Empty regions click through to the apps underneath.
- System tray with Show / Toggle Desktop Mode / Quit.
- Toolbar is **always compact in Electron** (single clean row at any width — Image · Video · Note · Link · Sample · More · Desktop · Min · Close), with a **More** menu holding every advanced action. The web/PWA build keeps the full inline pill row above 1500 px and collapses to the same compact layout below it.

### Mural objects
- **Images** — local files or direct URLs.
- **Videos** — local files or direct URLs, silent looping by default with hover controls.
- **Notes** — editable text cards with a small color palette.
- **Links** — see Smart link behavior below.
- Per-card **hover-only** controls: opacity · fit (cover / contain) · lock · duplicate · delete.
- **Tidy** shelf-packs every card into a clean grid inside the viewport.
- **Focus mode** centers and enlarges a card with a dimmed backdrop. `Esc` to exit.
- Snap guides while dragging, with a soft 24 px grid.
- Board opacity, theme, and accent controls in the toolbar.

### Smart embeds
A single Add-Link input becomes the right card based on the URL — no source picker, no manual toggles. Embeds support an **Interact** toggle so playable cards (YouTube, Spotify, CodePen, etc.) can be left ambient or activated on demand.

### Local-first storage
- **No account. No backend. No cloud.**
- Layout in `localStorage`, media blobs in IndexedDB.
- Per-origin, per-profile — your board never leaves the device unless you export it.

### Backup & export
- One-click **Backup** writes a single portable `.muraldesk.json` file (layout + base64-inlined media).
- **Layout-only Export** for quick sharing without media.
- **Import** auto-detects which of the two formats it's reading and re-sanitizes link URLs on the way in.

---

## Desktop Mode

The Electron build is where MuralDesk earns its name.

- The window itself is transparent — your wallpaper and other apps show through unchanged.
- A renderer-side hit-test flips click-through on the fly: cards stay clickable, empty regions don't capture mouse events.
- `Ctrl/Cmd + Shift + D` (or the toolbar **Desktop** pill) expands the overlay to cover the **current display** using window bounds — not OS-level fullscreen — so cards can move freely across the whole screen.
- The toolbar tucks into a thin reveal-zone at the top — bring the cursor up to show it again.

### Multi-monitor support

| Capability | Status |
|---|---|
| Move MuralDesk to any monitor (drag the window) | ✅ Available |
| Cover the **current** monitor as a transparent mural layer | ✅ Available |
| Span **all displays** as one big mural canvas | ✅ Available (Display toggle in Desktop Mode) |
| Separate **independent boards per monitor** | ⏳ Not available yet — see [Roadmap](#roadmap) |

Drag the window to whichever monitor you want, then press `Ctrl/Cmd + Shift + D` to make it cover that screen. The **Display** toggle in the toolbar switches between *current display* and *all displays* and is remembered between launches.

---

## Smart link behavior

| Pasted URL | Becomes |
|---|---|
| YouTube video | Embedded player |
| Vimeo video | Embedded player |
| SoundCloud track | Embedded widget |
| Spotify track / album / playlist | Embedded widget |
| CodePen pen | Embedded pen |
| Direct image URL (`.png` `.jpg` `.gif` `.webp` `.svg`) | Image card |
| Direct video URL (`.mp4` `.webm` `.mov` `.ogg`) | Looping video card |
| Any other normal `http(s)` website | Favicon + title web link card |
| `javascript:` / `data:` / `file:` / other unsafe URL | Blocked — no card created |

Anything that isn't `http:` or `https:` is stripped before a card is ever created — both on paste and on backup import.

---

## Local-first storage

- No account, no backend, no cloud sync.
- **Layout / metadata** lives in `localStorage` under `muraldesk-board`.
- **Uploaded media blobs** live in IndexedDB (`muraldesk` / `media`, keyed by UUID).
- Cross-machine portability is handled by the explicit one-click `.muraldesk.json` backup.
- The brand wordmark uses **Vastago**, loaded locally from `public/fonts/` — no third-party font CDN.

---

## Tech stack

| Layer | Choice |
|---|---|
| Renderer | React 18 · Vite 5 |
| Drag / resize | `react-rnd` |
| Desktop shell | Electron 31 |
| Packaging | electron-builder 25 (NSIS Windows installer) |
| Persistence | `localStorage` (layout) · IndexedDB (media blobs) |
| PWA | Hand-rolled `manifest.webmanifest` + service worker |

No backend. No auth. No analytics. No telemetry.

---

## Run locally

> The Electron desktop build needs a real desktop OS (Windows, macOS, or Linux). **Replit can run the web/PWA preview but cannot launch Electron desktop**, because the container lacks the GUI / GTK / Chromium system libraries Electron needs at runtime.

### Web

```bash
npm install
npm run dev:web
```

Vite serves the renderer at `http://localhost:5000`.

### Desktop

```bash
npm install
npm run dev:desktop
```

Spins up a dedicated Vite instance on `http://localhost:5173` and launches Electron pointed at it. Hot-reload works for renderer code; main-process changes need a manual restart.

### Build the Windows app

```bash
npm run build:desktop
```

Expected output:

```
release/MuralDesk-Setup-0.1.0.exe   ← NSIS installer
release/win-unpacked/MuralDesk.exe  ← unpacked binary
```

For a folder build with no installer (quick smoke test):

```bash
npm run build:desktop:dir
```

The installer is unsigned by default — see [Current limitations](#current-limitations).

---

## Demo flow

1. Open MuralDesk.
2. Click **✨ Sample** in the toolbar.
3. Click **▦ Tidy** to shelf-pack everything into a clean grid.
4. Drag and resize a few cards. Hover one and drop its opacity to ~40%.
5. Add a smart embed — paste a YouTube, Vimeo, SoundCloud, Spotify, or CodePen URL. Toggle **Interact** to play.
6. Press `Ctrl/Cmd + Shift + D` to enter **Desktop Mode**.
7. Click empty space to confirm it passes through to whatever's behind.
8. Click **📦 Backup** to export a portable `.muraldesk.json` file.

A second-by-second script lives in [`docs/DEMO_SCRIPT.md`](docs/DEMO_SCRIPT.md).

---

## Current limitations

- **Not a full wallpaper engine.** The overlay is a transparent window drawn *on top of* the desktop, not a true OS wallpaper layer drawn *under* desktop icons.
- **Multi-monitor is single-window.** Current-display and all-display overlays work today; **separate independent boards per monitor are not available yet**.
- **Unsigned Windows installer.** First-time launchers see a SmartScreen warning and have to click *More info → Run anyway*. Code signing requires a paid certificate.
- **Desktop builds need a real desktop OS.** Replit can't run Electron — use Windows, macOS, or Linux for `dev:desktop` and `build:desktop`.
- **No cloud sync, by design.** Backup is a manual, explicit step.
- **Web-version media is per-browser-profile.** IndexedDB is per-origin / per-profile. Use Backup to move between browsers.
- **Some link previews depend on the target site.** Sites that block embedding via `X-Frame-Options` or `Content-Security-Policy` fall back to a favicon + title card.

---

## Roadmap

- Per-monitor overlay windows / **independent boards per monitor**
- Snap guides and richer layout tools
- More board organization (groups, tags, search)
- Startup options and tray polish
- More embed providers
- Template boards
- Wallpaper-layer experiments (Windows-first, exploratory)
- Optional sync / sharing — *later, and strictly opt-in*; the app stays local-first by default

See [`ROADMAP.md`](ROADMAP.md) for detail.

---

## License

Released under the **MIT License** — see [LICENSE](LICENSE).
