# MuralDesk — Buildathon Submission

## Project name

**MuralDesk**

## One-line tagline

> A local-first visual mural layer for your desktop — pin images, videos, links, and notes onto a transparent overlay that floats over your real workspace.

## Short description

MuralDesk turns your desktop into a local-first visual mural layer where images, videos, links, and notes can live freely without becoming another messy app window. It runs as a transparent, click-through Electron overlay (and as an installable PWA in the browser), so your references sit *next to* your work instead of fighting it for window focus. Everything stays on your machine.

## Long description

MuralDesk is a small desktop app and PWA built around a simple observation: when people work with visual material, they end up coping with a mess of browser tabs, desktop folders, second monitors parked on Pinterest, and Slack-DMs-to-themselves. None of those feel like a real, quiet mural board you'd pin things to if you had wall space.

MuralDesk gives you that wall. You drop images, videos, and links onto a transparent layer, arrange them like sticky notes, and they stay there — across reboots, behind your apps, ready when you glance up. The Electron build makes the window itself transparent and click-through, so empty space passes mouse events to the apps underneath; you only "hit" cards when you actually want to interact with one. A fullscreen Desktop Canvas Mode turns the whole display into the mural surface for moments when references *are* the work.

There is no backend. No accounts. No telemetry. Layout metadata lives in `localStorage`; media bytes live in IndexedDB; cross-machine portability is handled by an explicit one-click backup file. The browser version is a full PWA with an installable manifest, branded icon set, and an offline app shell. The Electron version adds the transparent overlay, click-through, system tray, and Windows installer.

I built it during the buildathon to scratch my own itch and to test how far you can push a "feels like part of the OS" experience using only cross-platform primitives — `transparent: true`, `setIgnoreMouseEvents`, IndexedDB, and a service worker — without resorting to per-OS shell hacks.

## Problem

People keep visual references in messy browser tabs, scattered desktop folders, and second monitors playing YouTube — because there's no native, low-friction place to *pin* things on a real computer.

The coping strategies all share the same shape:

- A browser window full of tabs, each holding a single image or YouTube video.
- A folder on the desktop named `refs/` or `inspo/`, double-clicked open and arranged by hand.
- A second monitor permanently parked on a Pinterest board or YouTube playlist.
- Slack DMs to yourself acting as ad-hoc inboxes for screenshots.

These all "work," but they're noisy, they fight for window focus, and they don't survive a reboot. None of them feel like a quiet visual layer that's *just there* when you glance up.

## Solution

A transparent, click-through pinboard layer that lives on your desktop. Local-first. No accounts. Drop images, videos, and links onto it; arrange them like sticky notes; tab away to your real work; glance back when you need them.

The key positioning:

> MuralDesk turns your desktop into a local-first visual mural layer where images, videos, links, and notes can live freely without becoming another messy app window.

## Key features

- **Pin anything visual** — drag-and-drop or pick local images and videos, paste a URL, or write a sticky note. Items become draggable, resizable cards.
- **Smart links** — paste a URL and MuralDesk picks the right card type for you:
  - **YouTube · Vimeo · SoundCloud · Spotify · CodePen** URLs → embedded playable card (autoplay-muted where applicable, loops cleanly).
  - Direct video URLs (`.mp4`, `.webm`, `.mov`, `.ogg`) → inline `<video>` with mute / loop toggles.
  - Direct image URLs (`.png`, `.jpg`, `.gif`, `.webp`, `.svg`) → inline image card.
  - Any other normal web link → favicon + title preview card with Open and Copy URL chips.
- **Looping ambient videos** — local files and direct video links loop silently by default for true reference-clip feel; hover for mute / loop / interact controls.
- **Per-item polish** — every card has a hover-only mini-toolbar with opacity slider, object-fit toggle (cover / contain), lock, duplicate, and delete.
- **Transparent Electron overlay** — frameless, no shadow, fully transparent background; only the cards render.
- **Click-through empty areas** — renderer-side hit-test forwards mouse events to the OS for non-card regions via `setIgnoreMouseEvents`. Use the apps underneath without minimizing.
- **Full-display Desktop Canvas Mode** — `Ctrl/Cmd+Shift+D` (or toolbar button) toggles the Desktop Mode overlay: the transparent window expands to cover the current display via window bounds (not OS fullscreen), and the toolbar tucks into a thin reveal-zone at the top of the screen.
- **System tray** — closing hides to tray; tray menu has Show, Toggle Desktop Mode, and Quit.
- **Local-first persistence** — layout metadata in `localStorage` (`muraldesk-board`), media bytes in IndexedDB (`muraldesk` / `media` keyed by UUID). No data ever leaves the device.
- **Portable backup** — one click exports a single `.muraldesk.json` file bundling layout *and* base64-encoded media, restorable on any other machine. Import auto-detects backup vs. layout-only files.
- **PWA install** — installable in Chrome / Edge / Safari, fully offline-capable via a service worker app shell, with a branded icon set (192/512 PNG, maskable adaptive, Apple touch icon, multi-size favicon).
- **Sample board + keyboard shortcuts** — one-click sample mural to skip the empty state; `Ctrl/Cmd+Shift+I/V/L` opens the image / video / link pickers; `Ctrl/Cmd+Shift+D` toggles Desktop Mode.

## Technical stack

| Layer | Choice | Why |
|---|---|---|
| Renderer | React 18 + Vite 5 | Fast HMR, tiny bundle (~80 KB gzipped), no framework lock-in. |
| Drag / resize | `react-rnd` | Battle-tested, handles scaled containers and locked aspect ratios so I didn't have to. |
| Desktop shell | Electron 31 | Mature transparent-window support across Windows, macOS, and Linux. |
| Packaging | electron-builder 25 | One-line Windows `.exe` (NSIS), cross-builds from any host, no Wine needed for unsigned builds. |
| Persistence | `localStorage` + IndexedDB | Built into the browser, zero-dependency, offline-first, complementary size profiles (small + fast vs. large blobs). |
| PWA | hand-rolled `manifest.webmanifest` + `sw.js` | App-shell precache + cache-first for static assets, network-first for navigation, never intercepts `blob:` / `data:` so IndexedDB-backed object URLs are safe. |
| Icons | ImageMagick + librsvg | SVG source of truth → PNG / `.ico` rendering pipeline using only system tools, no `sharp` / `canvas` / `puppeteer` dependency. |

Total runtime dependencies: **`react`, `react-dom`, `react-rnd`, `uuid`.** That's it.

## What makes it innovative

- **Truly transparent + click-through, on cross-platform Electron.** Most "always-on-top" desktop apps render an opaque window with a fake-transparent background image. MuralDesk uses real OS-level window transparency (`transparent: true`, `hasShadow: false`, `backgroundColor: '#00000000'`) plus a renderer-driven hit-test that flips `setIgnoreMouseEvents` on/off as the cursor moves between cards and empty space. The result feels like a layer of the OS, not a window on top of it — and it works the same on Windows, macOS, and Linux because nothing is platform-specific.
- **Local-first, without compromise.** No cloud, no accounts, no telemetry, but cross-machine portability is solved cleanly via a single `.muraldesk.json` file with media base64-inlined. The split between localStorage (layout) and IndexedDB (blobs) is deliberate: localStorage's ~5 MB cap would make video impossible, IndexedDB alone would be slower for layout reads. Splitting them sidesteps both problems and keeps loads instant.
- **Smart link classification.** A single `<input>` becomes four different card types (YouTube embed / direct video / direct image / web preview) based on URL parsing — no per-source picker UI, no manual toggles. Unsafe protocols (`javascript:`, `data:`) are stripped on import so a malicious backup file can never produce a clickable href.
- **Two distinct export paths, one Import button.** Quick layout JSON for same-browser archival; portable `.muraldesk.json` backup with embedded media for cross-machine restore. Import auto-detects the format via a `kind: 'backup'` field, so users see one button instead of two confusing ones.
- **Ambient-first UX.** Hover-only mini-toolbars, opacity sliders, fit toggles, looping muted videos by default — every UX choice is biased toward "this should fade into the background" rather than "this should grab attention." That's the opposite of how most consumer apps are designed, and it's what makes a desktop overlay actually livable.
- **Zero heavy dependencies.** No `sharp` for image processing, no `puppeteer` for screenshots, no `electron-store` for window state, no `redux` / `zustand` for state. Custom hooks (`useBoard`, `useDesktopMode`, `useElectronClickThrough`) and the platform's own primitives do the work. The whole production bundle is ~80 KB gzipped.

## What was built during the buildathon

Everything below was implemented from scratch within the buildathon window:

- **Renderer scaffolding** — Vite + React 18 setup, custom design tokens (`--accent`, `--text`, `--text-muted`, etc.), no UI framework.
- **Board engine** (`src/hooks/useBoard.js`) — items state, add / update / remove / duplicate / clearBoard / exportLayout / importLayout, plus the localStorage + IndexedDB hydration / save pipeline (with blob-URL revoke on item removal to avoid memory leaks).
- **Media store** (`src/lib/mediaStore.js`) — IndexedDB wrapper with `saveBlob` / `getBlob` / `deleteBlob` / `clearAllBlobs`, schema version 1.
- **Card types** — `ImageCard`, `VideoCard` (with hover-only mute / loop / interact toggles), `NoteCard` (editable text + color swatches), `LinkCard` (smart classifier: YouTube / direct video / direct image / web preview / unsafe-URL placeholder).
- **Per-item polish** — hover-only mini-toolbar with opacity slider, fit toggle (cover / contain), lock, duplicate, delete; selection model with keyboard shortcuts.
- **Electron shell** (`electron/main.cjs`, `electron/preload.cjs`) — transparent / frameless / no-shadow window, persisted geometry, secure preload bridge, IPC for fullscreen / minimize / close / desktop-mode toggle.
- **Click-through + Desktop Canvas Mode** (`useElectronClickThrough`, `useDesktopMode`) — renderer hit-test, `setIgnoreMouseEvents` plumbing, fullscreen toggle that auto-hides the toolbar to a top reveal-zone.
- **System tray** — `Tray` with Show / Toggle Desktop Mode / Quit menu, hide-to-tray on close, dynamic menu refresh when overlay state changes.
- **Smart-link classifier** (`src/lib/linkType.js`, `LinkCard.jsx`) — protocol whitelist (`http:` / `https:` only — `javascript:`, `data:`, `file:`, etc. are stripped), per-provider host allow-lists and strict ID/slug regex validation for YouTube, Vimeo, SoundCloud, Spotify, and CodePen embeds, extension-based direct-video / direct-image detection, and a generic web-preview fallback with favicon and metadata fetch for everything else.
- **PWA layer** — `public/manifest.webmanifest`, `public/sw.js` (app-shell precache + smart fetch handler that never touches `blob:` URLs), installable across Chrome / Edge / Safari.
- **Branded icon set** — hand-authored SVG (dark rounded square + 3-card mural + purple accent) rendered to 8 PNG/ICO targets via ImageMagick, wired through `package.json` electron-builder config (`win.icon`, `linux.icon`, `mac.icon`) and `BrowserWindow({ icon })`.
- **Portable backup format** (`src/lib/backup.js`) — `buildBackup` / `restoreBackup` / `isBackupPayload` / `formatBytes`, base64 media encoding via FileReader, four explicit size limits (25 MB / 50 MB / 100 MB / 200 MB), skip-with-reason tracking so over-cap items still keep their layout without dangling references.
- **Sample board, empty state, keyboard shortcuts** — `Ctrl/Cmd+Shift+I/V/L/T/F` for image / video / link / toolbar / fullscreen.
- **Polished README + branding** — buildathon-ready documentation, honest limitations and roadmap sections, branded icon shown at the top.

## Demo script

A 90-second walkthrough that shows the app's full personality without dragging.

1. **Open the app on a normal desktop with a couple of windows visible.** Show that MuralDesk floats above them and that empty space *is* clicking through to the apps underneath — drag a window, click a button on it, etc., all without minimizing MuralDesk.
2. **Click `✨ Sample` in the toolbar.** A dozen-item mural appears: images, a looping video, a YouTube embed, a couple of notes, a few links. Drag a few cards around. Resize one. Hover one to show the mini-toolbar; drop its opacity to ~40% so it fades into the background.
3. **Paste a YouTube URL.** Show that it auto-becomes an embedded player. Paste a Vimeo, SoundCloud, Spotify, or CodePen URL — each auto-becomes the right embedded card. Paste a direct image URL. Show that it auto-becomes an image card. Paste a regular web link. Show that it becomes a preview card with favicon + title.
4. **Hit `Ctrl/Cmd+Shift+D`.** Desktop Mode toggles on: the transparent overlay window expands to cover the current display (via window bounds — not OS fullscreen), and the toolbar tucks into a thin reveal-zone at the top of the screen. Demonstrate that the mural now spans the whole display and that empty regions still click through to the apps underneath. Move the mouse to the very top to reveal the toolbar; move away to hide it. Hit `Ctrl/Cmd+Shift+D` again to restore the previous window size and position.
5. **Exit Desktop Mode. Close the window via the X.** The window hides; show that MuralDesk is now living in the system tray. Click the tray icon → window comes back exactly where it was.
6. **Click `📦 Backup`.** A `.muraldesk.json` file downloads. Open it briefly in a text editor to show the JSON structure with embedded base64 media — the file is portable, single-file, no folders.
7. **Click `🗑 Clear`** → confirm. Board empties.
8. **Click `↥ Import`** → choose the backup file. The whole mural reappears, exactly as it was, including the videos that are still looping in the corner.
9. **Refresh the page.** Everything persists. No upload happened, no account exists, the only network requests in DevTools are to fetch link favicons.
10. **Mention the install button** in the browser address bar — MuralDesk is also a real PWA. Install it on Chrome, show it appears in the OS app drawer with the same branded icon.

If a judge has 30 seconds instead of 90, just do steps 1–4. The transparent overlay + click-through + Desktop Canvas Mode is the "wow" moment.

## Future roadmap

Ordered roughly by user demand and tractability, not by ambition.

- **Multi-monitor windows.** A mural per display, with the option to mirror or treat each as an independent board.
- **Tray polish.** Show the current board name, expose Add Image / Add Video shortcuts in the tray menu, add a "Lock all items" toggle.
- **Snap guides and grids.** Optional alignment guides when dragging — center-line, edge-snapping, soft grid — without forcing a rigid layout.
- **Board-level opacity / focus controls.** Global "dim everything to 30%" toggle for when the mural should fade behind the active app; "spotlight" mode that highlights only the hovered card.
- **Launch on startup.** Auto-launch the Electron app on login, with flags for start-in-tray and start-in-Desktop-Canvas-Mode.
- **Wallpaper-layer experiments.** Per-OS exploration of the shell-level wallpaper layer trick (`SHELLDLL_DefView` on Windows, `NSWindowLevel` on macOS) to render *under* desktop icons. Likely Windows-first because the API surface is the most documented.
- **Encrypted backup format.** A passphrase-protected variant of the `.muraldesk.json` export for emailing backups without exposing references.
- **Snip-and-pin screenshot capture.** A hotkey that takes a region screenshot and pins it directly to the mural — no save-to-disk roundtrip.
- **Optional cloud sync, opt-in only.** A bring-your-own-storage adapter (Dropbox / iCloud Drive / a folder in OneDrive) that syncs the backup file automatically. Off by default; local-first stays the headline.

## Honest limitations

I'd rather be judged on what the project actually is than on what a marketing page would imply.

- **Not a true wallpaper engine yet.** The Electron window is transparent and click-through, which gets you 90% of the "feels like wallpaper" experience — but it's still a window drawn *on top of* your real wallpaper. A true wallpaper layer (rendered *under* desktop icons by the OS shell) requires platform-specific shell integration I haven't tackled. The current overlay approach has the upside of working identically on all three OSes.
- **Multi-monitor support is basic.** The window remembers its position and size, so it reopens on the monitor you left it on. It doesn't yet open a separate mural per display, and Desktop Canvas Mode goes fullscreen on whichever screen the window currently sits on.
- **Unsigned Windows builds trigger SmartScreen.** The NSIS installer is unsigned, so first-time launchers see the "Windows protected your PC" warning and have to click "More info → Run anyway." This is normal for hobby / buildathon builds; signing requires an EV code-signing certificate (~$200/year) that wasn't worth purchasing for the buildathon scope. Documenting this is more useful than papering over it.
- **No cloud sync, by design.** Backup is a manual, explicit step. If you want your mural on two machines, you export and import. There's no Dropbox / iCloud auto-sync because adding one would compromise the local-first promise without a clear, opt-in story.
- **Web version's media is per-browser-profile.** IndexedDB is per-origin / per-profile, so opening MuralDesk in Chrome and then in Firefox shows two empty boards. The Backup feature is the bridge.
- **Some link previews depend on the target site.** Sites that block embedding via `X-Frame-Options` or `Content-Security-Policy` fall back to a card with favicon + title rather than a live preview. That's a browser-level constraint, not something I can route around without a proxy server (which would break local-first).
- **Backup file size is bounded.** The portable backup caps at 25 MB per blob and 100 MB total — generous for image-heavy boards, restrictive for hour-long video archives. By design: backup files are meant to be portable (downloadable, emailable, droppable on another machine), not archival.
- **Tested most heavily on Windows + Chrome.** macOS and Linux Electron builds are expected to work and use the same primitives, but they haven't been exhaustively tested in the buildathon timeframe.

## Links

- **GitHub:** https://github.com/wpggLabs/muraldesk
