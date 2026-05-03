# MuralDesk — Buildathon Submission

## Project name

**MuralDesk**

## Tagline

> A local-first visual mural layer for your desktop.

## Short description

MuralDesk turns your desktop into a local-first visual mural layer where images, videos, smart embeds, links, and notes can live freely without becoming another messy app window. It runs as a transparent, click-through Electron overlay (and as an installable PWA in the browser), so your references sit *next to* your work instead of fighting it for window focus. Everything stays on your machine.

## Problem

People keep visual references in messy browser tabs, scattered desktop folders, and second monitors playing YouTube — because there's no native, low-friction place to **pin** things on a real computer.

The coping strategies all share the same shape:

- A browser window full of tabs, each holding a single image or video.
- A folder on the desktop named `refs/` or `inspo/`, double-clicked open and arranged by hand.
- A second monitor permanently parked on a Pinterest board or YouTube playlist.
- Slack DMs to yourself acting as ad-hoc inboxes for screenshots.

These all "work," but they're noisy, they fight for window focus, and they don't survive a reboot. None of them feel like a quiet visual layer that's *just there* when you glance up.

## Solution

A transparent, click-through pinboard layer that lives on your desktop. Local-first. No accounts. Drop images, videos, and links onto it; arrange them like sticky notes; tab away to your real work; glance back when you need them.

## Key features

- **Pin anything visual** — drag-and-drop or pick local images and videos, paste a URL, or write a sticky note. Items become draggable, resizable, lockable cards with hover-only mini-toolbars (opacity · fit · lock · duplicate · delete).
- **Smart embeds** — a single Add-Link input becomes the right card based on the URL:
  - **YouTube · Vimeo · SoundCloud · Spotify · CodePen** → embedded playable card with an **Interact** toggle so it stays ambient until you want to use it.
  - **Direct video URLs** (`.mp4`, `.webm`, `.mov`, `.ogg`) → inline `<video>` with mute / loop / interact toggles.
  - **Direct image URLs** (`.png`, `.jpg`, `.gif`, `.webp`, `.svg`) → inline image card.
  - **Any other `http(s)` link** → favicon + title preview card with Open and Copy URL chips.
  - **Unsafe URLs** (`javascript:`, `data:`, `file:`, etc.) → blocked before a card is ever created, on paste *and* on backup import.
- **Looping ambient videos** — local files and direct video links loop silently by default for true reference-clip feel.
- **Transparent Electron overlay** — frameless, no shadow, fully transparent background; only the cards render.
- **Click-through empty areas** — renderer-side hit-test forwards mouse events to the OS for non-card regions via `setIgnoreMouseEvents`. Use the apps underneath without minimizing.
- **Full-display Desktop Mode** — `Ctrl/Cmd + Shift + D` (or the toolbar pill) toggles the Desktop Mode overlay: the transparent window expands to cover the current display via window bounds (not OS fullscreen), and the toolbar tucks into a thin reveal-zone at the top of the screen.
- **Multi-monitor coverage** — drag MuralDesk to any monitor and cover that monitor; or switch the Display toggle to **All** to span every display as one big mural canvas. (Independent boards per monitor are roadmap, not shipped.)
- **System tray** — closing hides to tray; tray menu has Show, Toggle Desktop Mode, and Quit.
- **Tidy + Focus + snap + theme + accent** — shelf-pack the whole board into a grid, double-click any card for a centered Focus view, snap-to-grid while dragging, theme and accent controls in the toolbar.
- **Local-first persistence** — layout metadata in `localStorage` (`muraldesk-board`), media bytes in IndexedDB (`muraldesk` / `media` keyed by UUID). No data ever leaves the device.
- **Portable backup** — one click exports a single `.muraldesk.json` file bundling layout *and* base64-encoded media, restorable on any other machine. Layout-only Export is a separate quick-share path. Import auto-detects the format.
- **PWA install** — installable in Chrome / Edge / Safari, fully offline-capable via a service worker app shell, with a branded icon set.
- **Branded typography** — the Vastago wordmark loads locally from `public/fonts/` — no third-party font CDN.

## Technical stack

| Layer | Choice | Why |
|---|---|---|
| Renderer | React 18 + Vite 5 | Fast HMR, ~80 KB gzipped bundle, no UI-framework lock-in. |
| Drag / resize | `react-rnd` | Battle-tested; handles scaled containers and locked aspect ratios. |
| Desktop shell | Electron 31 | Mature transparent-window support across Windows, macOS, and Linux. |
| Packaging | electron-builder 25 | One-line Windows `.exe` (NSIS), cross-builds from any host. |
| Persistence | `localStorage` + IndexedDB | Built-in, zero-dependency, offline-first; complementary size profiles (small + fast vs. large blobs). |
| PWA | Hand-rolled `manifest.webmanifest` + `sw.js` | App-shell precache; never intercepts `blob:` / `data:` so IndexedDB-backed object URLs are safe. |

Total runtime dependencies: **`react`, `react-dom`, `react-rnd`, `uuid`.** That's it. Production bundle ~80 KB gzipped.

## What makes it innovative

- **Truly transparent + click-through, on cross-platform Electron.** Most "always-on-top" desktop apps render an opaque window with a fake-transparent background image. MuralDesk uses real OS-level window transparency (`transparent: true`, `hasShadow: false`, `backgroundColor: '#00000000'`) plus a renderer-driven hit-test that flips `setIgnoreMouseEvents` on/off as the cursor moves between cards and empty space. The result feels like a layer of the OS, not a window on top of it — and it works the same on Windows, macOS, and Linux because nothing is platform-specific.
- **Local-first, without compromise.** No cloud, no accounts, no telemetry, but cross-machine portability is solved cleanly via a single `.muraldesk.json` file with media base64-inlined. The split between localStorage (layout) and IndexedDB (blobs) is deliberate.
- **Smart link classification with a strict safety contract.** A single `<input>` becomes five different card types based on URL parsing — no per-source picker UI, no manual toggles. Per-provider host allow-lists and strict ID/slug regex validation gate every embed. Unsafe protocols are stripped on paste *and* on import.
- **Two distinct export paths, one Import button.** Quick layout JSON for same-browser archival; portable `.muraldesk.json` backup with embedded media for cross-machine restore. Import auto-detects the format.
- **Ambient-first UX.** Hover-only mini-toolbars, opacity sliders, fit toggles, looping muted videos by default, an Interact toggle on embeds — every UX choice is biased toward "fade into the background" rather than "grab attention." That's the opposite of how most consumer apps are designed, and it's what makes a desktop overlay actually livable.
- **Zero heavy dependencies.** No `sharp`, no `puppeteer`, no `electron-store`, no Redux/Zustand. Custom hooks (`useBoard`, `useDesktopMode`, `useElectronClickThrough`) and the platform's own primitives do the work.

## What was built

Everything below was implemented from scratch within the buildathon window:

- **Renderer scaffolding** — Vite + React 18 setup, custom design tokens, no UI framework.
- **Board engine** (`src/hooks/useBoard.js`) — items state, add / update / remove / duplicate / clearBoard / exportLayout / importLayout, plus the localStorage + IndexedDB hydration / save pipeline (with blob-URL revoke on item removal).
- **Media store** (`src/lib/mediaStore.js`) — IndexedDB wrapper with `saveBlob` / `getBlob` / `deleteBlob` / `clearAllBlobs`.
- **Card types** — `ImageCard`, `VideoCard` (hover mute / loop), `NoteCard` (editable text + color swatches + theme-aware contrast), `LinkCard` (smart classifier + Interact toggle).
- **Per-item polish** — hover-only mini-toolbar with opacity slider, fit toggle (cover / contain), lock, duplicate, delete; selection model with keyboard shortcuts.
- **Electron shell** (`electron/main.cjs`, `electron/preload.cjs`) — transparent / frameless / no-shadow window, persisted geometry (gated outside Desktop Mode), secure preload bridge with `contextIsolation` + `sandbox`, IPC for desktop-mode toggle / display-mode toggle / minimize / close.
- **Click-through + Desktop Mode** (`useElectronClickThrough`, `useDesktopMode`) — renderer hit-test, `setIgnoreMouseEvents` plumbing, current-display vs all-displays toggle persisted to `localStorage`, replayed on launch.
- **System tray** — `Tray` with Show / Toggle Desktop Mode / Quit menu, hide-to-tray on close, dynamic menu refresh, graceful fallback if tray creation fails.
- **Smart-link classifier** (`src/lib/linkType.js`) — protocol whitelist (`http(s)` only), per-provider host allow-lists, strict ID/slug regex for YouTube / Vimeo / SoundCloud / Spotify / CodePen, extension-based direct-video / direct-image detection, generic web-preview fallback with favicon + metadata fetch.
- **PWA layer** — `public/manifest.webmanifest`, `public/sw.js` (app-shell precache + smart fetch handler that never touches `blob:` URLs), installable across Chrome / Edge / Safari.
- **Branded icon set + Vastago wordmark** — hand-authored SVG → 8 PNG/ICO targets via ImageMagick, locally-hosted Vastago font; no font CDN, no `sharp`/`canvas`/`puppeteer` dependency.
- **Portable backup format** (`src/lib/backup.js`) — `buildBackup` / `restoreBackup` / `isBackupPayload` / `formatBytes`, base64 media encoding, four explicit size limits, skip-with-reason tracking so over-cap items still keep their layout without dangling references, link-URL re-sanitization on restore.
- **Toolbar UX** — compact mode under 1500 px viewport with a **More** menu (Tidy / Export / Backup / Import / Snap / Board / Focus / Theme / Accent / Shortcuts / Fullscreen / Clear), Sample Board, EmptyState, in-app keyboard shortcuts modal.
- **Polished docs** — README, this submission doc, `docs/DEMO_SCRIPT.md`, `docs/SCREENSHOTS.md`, `docs/RELEASE.md`, `ROADMAP.md`, `PRODUCT.md`.

## Demo script

A 60-second walkthrough lives in [`docs/DEMO_SCRIPT.md`](docs/DEMO_SCRIPT.md), with timestamps, voiceover, on-screen action, captions, and a 30-second emergency cut.

The flow:

1. Launch MuralDesk on a normal desktop with windows visible behind it. Show that empty regions click through.
2. Click **✨ Sample** → mural appears.
3. Click **▦ Tidy** → cards shelf-pack into a grid.
4. Drag, resize, drop opacity on a card.
5. Paste a YouTube / Spotify / CodePen URL → correct embed appears. Toggle **Interact** to play.
6. Press `Ctrl/Cmd + Shift + D` → Desktop Mode covers the current display. Move the cursor to the top to reveal the toolbar.
7. Click empty space → click goes through to the app behind.
8. Toggle Display to **All** → overlay spans every monitor.
9. Press `Ctrl/Cmd + Shift + D` again → back to a normal window.
10. Click **📦 Backup** → portable `.muraldesk.json` downloads. Refresh → board persists. Mention PWA install in Chrome.

## Known limitations

- **Not a full wallpaper engine.** The overlay is a transparent window drawn on top of the desktop, not a true OS wallpaper layer drawn under desktop icons.
- **Independent per-monitor boards aren't shipped yet.** Current-display and all-display overlays work; one independent board per monitor is on the roadmap.
- **Windows installer is unsigned**, so SmartScreen will warn first-time users. Code signing requires a paid certificate.
- **Electron desktop must be tested on a real desktop OS.** Replit's container lacks GUI / GTK / Chromium libraries; only the web/PWA preview runs there.
- **Some web-link previews depend on the target site** — pages that block embedding via `X-Frame-Options` / CSP fall back to favicon + title cards.
- **Web-version media is per-browser-profile.** IndexedDB is per-origin / per-profile; use Backup to move between browsers.

## Roadmap

See [`ROADMAP.md`](ROADMAP.md). Highlights:

- Per-monitor overlay windows / independent boards per monitor
- Snap guides + richer layout tools
- Startup options and tray polish
- More embed providers and template boards
- Wallpaper-layer experiments (Windows-first, exploratory)
- Optional sync / sharing — *later, opt-in*; the app stays local-first by default

## Links

- Repository: this repo
- License: [MIT](LICENSE)
- Demo script: [`docs/DEMO_SCRIPT.md`](docs/DEMO_SCRIPT.md)
- Screenshot checklist: [`docs/SCREENSHOTS.md`](docs/SCREENSHOTS.md)
- Release / build guide: [`docs/RELEASE.md`](docs/RELEASE.md)
- Roadmap: [`ROADMAP.md`](ROADMAP.md)
- Product brief: [`PRODUCT.md`](PRODUCT.md)
