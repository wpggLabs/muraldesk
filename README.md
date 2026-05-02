# MuralDesk

> MuralDesk turns your desktop into a local-first visual mural layer where images, videos, links, and notes can live freely without becoming another messy app window.

![MuralDesk app icon](public/icon.svg)

---

## What it is

MuralDesk is a desktop visual mural app. You drop images, videos, YouTube links, direct media links, regular web links, and sticky notes onto a clean transparent canvas that floats over your real desktop. Cards are draggable and resizable, and the overlay is click-through over empty space — so your apps underneath stay usable while your references sit *next to* your work.

It also runs as a standard Progressive Web App in the browser, so you can install it like a native app on Chrome / Edge / Safari without the Electron build.

---

## Why it exists

**Problem.** People keep visual references in messy browser tabs, scattered desktop folders, screenshots dumped to `~/Downloads`, second monitors permanently parked on Pinterest or YouTube, and Slack DMs to themselves. None of those feel like a real, quiet mural board you'd pin things to if you had wall space.

**Solution.** MuralDesk gives you that wall: a clean, local-first, transparent desktop layer for visual references, ambient looping media, inspiration boards, and workspace memory. No accounts, no backend, no cloud — your stuff stays on your machine.

---

## Core features

- **Transparent Electron desktop overlay** — frameless, no shadow, fully transparent background; only the cards render.
- **Click-through empty areas** — empty regions forward mouse events to the OS so the apps behind MuralDesk stay clickable.
- **Full-display Desktop Mode** — `Ctrl/Cmd+Shift+F` (or the toolbar button) expands the overlay to cover the current display and tucks the toolbar into a thin reveal-zone at the top.
- **Drag and resize** — every card is a draggable, resizable surface (powered by `react-rnd`).
- **Hover-only controls** — each card reveals a compact mini-toolbar on hover: opacity slider, fit toggle (cover / contain), lock, duplicate, delete.
- **Lock / duplicate / delete** — keep an item in place, clone any card (including its media blob), or remove it.
- **Images** — drag-and-drop or pick local image files; rendered as resizable image cards.
- **Videos** — local video files loop silently by default, with hover-only mute / loop / interact toggles.
- **Notes** — editable text cards with a small palette of color swatches.
- **Smart links** — paste a URL and MuralDesk picks the right card type:
  - **YouTube** URLs → embedded player (autoplay-muted, loops cleanly).
  - **Direct video URLs** (`.mp4`, `.webm`, `.mov`) → inline video card with mute / loop toggles.
  - **Direct image URLs** (`.png`, `.jpg`, `.gif`, `.webp`) → inline image card.
  - **Anything else** → web link card with favicon, title, and an Open button.
- **YouTube interact mode** — by default the embed is non-interactive so it doesn't steal clicks; toggle interact-mode on a card to seek, pause, or unmute.
- **Local-first persistence** — layout in `localStorage`, media blobs in IndexedDB. Nothing leaves the device.
- **Export / import layout** — quick `.json` dump of item positions and metadata for same-browser archival.
- **Portable backup** — one-click `.muraldesk.json` export bundles layout *and* base64-encoded media into a single file, restorable on any machine. Import auto-detects backup vs. layout-only files.
- **PWA / web version** — installable in Chrome / Edge / Safari, fully offline-capable via a service worker app shell, with a branded icon set.
- **System tray** — closing the Electron window hides it to the system tray; the tray menu has Show, Toggle Desktop Mode, and Quit.
- **No login, no backend, no cloud storage.**

---

## Desktop mode

The Electron build is where MuralDesk earns its name.

- The window is **transparent and frameless** — only the cards you've pinned render, the rest of the desktop shows through.
- **Empty areas click through** to whatever is behind MuralDesk (the OS desktop or another app), so you can keep the mural always-on while still using your tools normally.
- **Items stay interactive.** A renderer-side hit-test detects when the cursor is over a card or the toolbar and flips click-through off so drags, resizes, slider tweaks, and YouTube controls work normally.
- **Desktop Mode** expands the overlay to cover the entire current display (using window bounds, not OS-level fullscreen), so cards can be moved freely across the whole screen. The toolbar auto-hides into a thin reveal-zone at the top — move the cursor up to bring it back.
- **System tray** keeps the app reachable in the background. Closing the window hides to tray on Windows / Linux instead of quitting.

---

## Storage

All data is local. There is no account, no backend, no cloud sync.

- **Layout and item metadata** (positions, sizes, types, opacity, fit, link URLs, note text) live in `localStorage` under the key `muraldesk-board`. Small, fast, survives reloads.
- **Uploaded media blobs** (images and videos) live in **IndexedDB** in a database called `muraldesk`, object store `media`, keyed by a UUID per item. The localStorage layout only stores the UUID; the actual blob is fetched from IndexedDB on load and converted into a `blob:` URL at runtime.
- **Why split them?** localStorage has a ~5 MB cap per origin in most browsers — fine for layout JSON, fatal for video. IndexedDB has no practical size limit and stores binary `Blob`s natively.
- **Cross-machine portability** is handled by the explicit Backup feature, which inlines media as base64 into a single `.muraldesk.json` file.

---

## Smart link behavior

A single Add Link input becomes four different card types based on URL parsing — no per-source picker, no manual toggles.

- **YouTube URLs** → embedded playable card (uses `youtube-nocookie.com`).
- **Direct image URLs** (extension-based: `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.svg`) → image card.
- **Direct video URLs** (extension-based: `.mp4`, `.webm`, `.mov`, `.ogg`) → playable video card with hover-only mute / loop / interact controls.
- **Normal web URLs** → link card with favicon, title, and an **Open** button that launches the URL in your default browser.
- **Unsafe protocols are blocked.** Anything that isn't `http:` or `https:` (e.g. `javascript:`, `data:`, `file:`) is stripped before a card is ever created — both on paste and on backup import — so a malicious link can never become a clickable href.

---

## Tech stack

| Layer | Choice |
|---|---|
| Renderer | React 18 + Vite 5 |
| Drag / resize | `react-rnd` |
| Desktop shell | Electron 31 |
| Layout persistence | `localStorage` |
| Blob persistence | IndexedDB |
| PWA | hand-rolled `manifest.webmanifest` + `sw.js` |

No backend, no auth, no analytics, no proprietary services.

---

## Running it

> **Note.** The Electron desktop build must be run on a real desktop OS (Windows, macOS, or Linux). It cannot run inside Replit's container, which lacks the GUI / GTK / Chromium system libraries that Electron needs. The web / PWA build runs anywhere.

### Web (development)

```bash
npm install
npm run dev:web
```

Vite serves the renderer on `http://localhost:5000`. Open it in any modern browser.

### Desktop (development)

```bash
npm install
npm run dev:desktop
```

This spins up a dedicated Vite instance on `http://localhost:5173` (with `--strictPort` for a deterministic renderer URL) and launches Electron pointed at it. Hot-reload works for renderer code; main-process changes need a manual restart.

### Web (production build)

```bash
npm run build:web
```

Outputs a static site to `dist/`. Serve it with any static host (`npx serve dist`, GitHub Pages, Netlify, Vercel, your own nginx — all work).

### Desktop (Windows installer)

```bash
npm run build:desktop
```

Expected output:

```
release/MuralDesk-Setup-0.1.0.exe
release/win-unpacked/MuralDesk.exe
```

The installer is unsigned by default (see Limitations below). For a folder build with no installer (useful for quick smoke tests):

```bash
npm run build:desktop:dir
```

---

## Demo flow

A short walkthrough that shows the app's full personality:

1. **Launch MuralDesk.**
2. **Click `✨ Sample`** in the toolbar to load the sample board — a dozen pre-arranged cards with images, a looping video, a YouTube embed, notes, and links.
3. **Add an image, a video, a note, and a link** of your own from the toolbar (or use the keyboard shortcuts `Ctrl/Cmd+Shift+I/V/L`).
4. **Drag and resize cards** across the desktop. Hover any card to reveal its mini-toolbar — try dropping the opacity to ~40% so a busy reference fades into the background.
5. **Paste a YouTube URL.** It auto-becomes an embedded player. Toggle interact-mode on the card and seek / pause / unmute it.
6. **Show the click-through transparent area:** click through an empty region of the overlay to the desktop or app underneath. Drag a window behind MuralDesk to prove the mural isn't capturing those clicks.
7. **Hit `Ctrl/Cmd+Shift+F`** to enter Desktop Mode — the overlay expands to cover the whole display and the toolbar tucks to the top reveal-zone.
8. **Click `📦 Backup`** to export a single `.muraldesk.json` containing your layout *and* media. Open it briefly in a text editor to show it's a portable single file.
9. **Refresh / reopen.** Everything persists. No upload happened, no account exists.

---

## Current limitations

I'd rather be judged on what the project actually is than on what a marketing page would imply.

- **Not a full wallpaper engine yet.** The Electron window is transparent and click-through, which gets you most of the "feels like wallpaper" experience — but it's still a window drawn on top of your real wallpaper. A true wallpaper layer (rendered *under* desktop icons by the OS shell) requires platform-specific shell integration that isn't in scope yet.
- **Unsigned Windows builds trigger SmartScreen.** First-time launchers see the "Windows protected your PC" warning and have to click "More info → Run anyway." This is normal for hobby / buildathon builds; signing requires a paid code-signing certificate.
- **Electron desktop builds must be tested on Windows / macOS / Linux, not Replit.** Replit's container lacks the GUI / GTK / Chromium system libraries Electron needs at runtime, so `npm run dev:desktop` and `npm run build:desktop` cannot run there. Use a real desktop OS for those scripts.
- **Multi-monitor support is basic.** The window remembers its position and reopens on the monitor you left it on, but there is no per-display mural yet. Desktop Mode covers the current display only.
- **No cloud sync.** Backup is a manual, explicit step. If you want your mural on two machines, you export and import. Adding cloud sync would compromise the local-first promise without a clear, opt-in story.
- **Web version's media is per-browser-profile.** IndexedDB is per-origin / per-profile, so opening MuralDesk in Chrome and then in Firefox shows two empty boards. The Backup feature is the bridge.
- **Some link previews depend on the target site.** Sites that block embedding via `X-Frame-Options` or `Content-Security-Policy` fall back to a card with favicon + title rather than a live preview.

---

## Roadmap

Ordered roughly by user demand and tractability, not by ambition.

- **Better multi-monitor support** — a mural per display, with the option to mirror or treat each as an independent board.
- **Per-monitor overlay windows** — one transparent overlay per attached display, instead of a single window that spans or sits on one.
- **Snap guides** — optional alignment guides when dragging (center-line, edge-snapping, soft grid) without forcing a rigid layout.
- **More layout tools** — board-level opacity / focus controls, "spotlight" mode for the hovered card, group-select.
- **Startup launch** — auto-launch the Electron app on login, with flags for start-in-tray and start-in-Desktop-Mode.
- **Theme controls** — light / dark / custom-accent themes for the toolbar and note swatches.
- **More embed types** — Vimeo, SoundCloud, Spotify, CodePen, and other oEmbed-friendly providers.
- **Wallpaper-layer experiments** — per-OS exploration of the shell-level wallpaper layer trick (likely Windows-first, where the API surface is the most documented).

---

## License

Released under the MIT License — see LICENSE.
