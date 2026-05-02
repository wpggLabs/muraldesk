# MuralDesk

## Overview
MuralDesk is a local-first, visual desktop pinboard application built with React and Vite. It enables users to pin various media types (images, videos, notes, links) onto a canvas-style board with functionalities like drag, resize, duplicate, and lock. All user data, including layout and media binaries, is saved locally on the user's machine, ensuring privacy and offline access without relying on backend services.

## User Preferences
I want iterative development.
Ask before making major changes.
Do not make changes to the persistence section.

## System Architecture
MuralDesk is a frontend-only application using React and Vite, designed for static deployment. The UI/UX features a full-viewport canvas where items appear as free-floating objects, revealing controls only on hover/selection. A floating pill toolbar at the top-center provides main actions and auto-dims when not in use.

**Key Technical Implementations:**
-   **Drag and Resize:** Implemented using `react-rnd`.
-   **Local Persistence:** `localStorage` is used for layout data, while `IndexedDB` stores image and video binary large objects (blobs).
-   **PWA Capabilities:** Includes a web manifest and a basic app-shell service worker for installability and offline access in production builds.
-   **Card Types:**
    -   **ImageCard:** Displays images.
    -   **VideoCard:** Plays videos with hover-only mute/loop controls.
    -   **NoteCard:** Editable text notes with hover-only color swatches.
    -   **LinkCard:** Smartly classifies and renders links as YouTube embeds, videos, images, web previews, or an "unsafe URL" placeholder.
- **Branding & app icons:** the source of truth is `public/icon.svg` (a dark rounded square with a small mural of three pinned cards, middle card in the brand purple `#6c63ff`). All other formats are rendered from the SVG via ImageMagick at build/asset-prep time — no `sharp` / `canvas` / `puppeteer` dependency was added. Generated set: `public/icon-{192,512}.png` (PWA), `public/icon-maskable.svg` + `public/icon-maskable-512.png` (PWA adaptive), `public/apple-touch-icon.png` (180×180), `public/favicon.ico` (multi-size 16/32/48), `electron/icon.png` (256×256, runtime BrowserWindow icon shipped via the existing `electron/**/*` files glob), `electron/tray-icon.png` (32×32, regenerated from new SVG), `build/icon.png` (512×512, electron-builder Linux/Mac fallback) and `build/icon.ico` (multi-size 16/24/32/48/64/128/256 — Windows .exe + NSIS installer icon, wired in `package.json` under `build.win.icon`). The renderer in `electron/main.cjs` passes `icon: path.join(__dirname, 'icon.png')` to `BrowserWindow` so the Windows taskbar / Linux WM shows the brand mark from first paint, before the OS-level shortcut icon takes over. Rebuild any time the SVG changes by re-running the ImageMagick commands documented in this file's "How to regenerate icons" section. **Important:** SVG source files cannot contain `--` (double-hyphen) anywhere inside `<!-- -->` comments — librsvg (used by ImageMagick's SVG delegate) follows the strict XML spec and will refuse to parse the file.
- **Export / Import — two paths, one Import button:** the toolbar exposes both a quick layout export and a portable backup export; a single Import button auto-detects which format it's reading. (a) **Quick Export (`↧`):** `useBoard.exportLayout()` returns `{version:1, app, exportedAt, items}` — item metadata only (media items keep `mediaId` but no `src`). Compact, fully restorable only on the SAME browser. Filename `muraldesk-layout-<stamp>.json`. (b) **Backup Export (`📦`):** `src/lib/backup.js#buildBackup` walks the items, reads each `mediaId`'s blob from IndexedDB, encodes it as base64, and emits `{app, kind:'backup', version:1, exportedAt, items, media:{[mediaId]:{mime,size,data}}}`. Filename `muraldesk-backup-<stamp>.muraldesk.json`. (c) **Import (`↥`):** parses the file, calls `isBackupPayload(parsed)` — if `kind==='backup'` and `media` is present, runs `restoreBackup(payload)` which writes each base64 blob back to IDB at its original `mediaId`, **then** calls the existing `useBoard.importLayout(items)` whose existing `hydrateMediaSrcs` step rebuilds `src` URLs from the now-populated IDB exactly as on first load; otherwise falls back to the legacy layout-only path (5 MB / 500 items). Persistence pipeline (localStorage for metadata, IndexedDB for blobs) is **unmodified** — `useBoard.js` and `mediaStore.js` are untouched. Size limits live in `src/lib/backup.js`: `MAX_BLOB_BYTES = 25 MB` per file (items above this get their `mediaId` stripped and exported metadata-only — no dangling reference on restore), `WARN_TOTAL_BYTES = 50 MB` total raw blob bytes (confirm() before download), `MAX_TOTAL_BYTES = 100 MB` (items past the cap in iteration order are exported metadata-only), `MAX_IMPORT_FILE_BYTES = 200 MB` on disk (rejected before parsing). Base64 inflates raw bytes by ~33%, factored into the on-disk-size warning. Both import paths share a `sanitize()` helper that strips non-http(s) protocols on link items so an imported `javascript:`/`data:` URL can never become a clickable href. Per-item `opacity`, `fit`, `locked`, `loop`, `muted`, etc. all round-trip through both export paths automatically because `buildBackup` and the layout export both spread the full item shape.
    -   **Per-item opacity + fit:** Each pinned item has an opacity setting and image/video items also have a fit setting (`'cover'` | `'contain'`), controlled via compact icon-buttons in the hover-only mini-toolbar.
- **Snap-to-grid + alignment guides:** Optional 24-px snap mode toggled from the toolbar (`🧲 Snap` pill, default OFF). State lives in `src/hooks/useSnap.js` and persists to its own localStorage key `muraldesk-snap` (raw `'on'`/`'off'`), kept **completely separate** from `useBoard`'s `muraldesk-board` key — neither side reads or writes the other. When ON, `BoardItem` forwards `[24, 24]` to react-rnd's native `dragGrid` + `resizeGrid` props (no custom snap math) and renders two `position: fixed`, `pointerEvents: none` accent-colored guide lines through the dragging card's center as a soft alignment hint. Snap-OFF render path is byte-identical to the pre-snap implementation: every guide-state lifecycle call (`setActiveRect` at start/drag/resize/stop) is gated behind `if (snap)`, so the existing free-drag feel and frame stability are preserved. Grid size 24 px is exported as `SNAP_GRID` from `useSnap.js` and divides evenly into all default card sizes (120/180/220/280/300/360).
-   **Selection & Interaction:** Items are selectable with a click, supporting keyboard shortcuts for deselection and removal.
-   **Desktop Target (Electron):** An optional Electron shell provides a desktop application experience, including a "Desktop Canvas Mode" for an immersive, full-screen overlay and local persistence of window state. IPC is minimal and secured.
    -   **Transparent overlay mode:** The Electron build uses a transparent, frameless window to float items over the user's desktop.
    -   **Desktop Canvas Mode:** Expands the application to cover the entire physical monitor without using OS-level fullscreen, allowing items to be dragged across the display. Supports `'current'` or `'all'` display modes.
    -   **System Tray:** Provides always-reachable control over the application, especially in transparent click-through mode, allowing hiding, showing, and quitting the app.
    -   **Keyboard Shortcuts:** Electron-specific shortcuts for desktop mode, toolbar visibility, and adding items, carefully designed to avoid browser conflicts.
    -   **Click-through:** Transparent empty areas of the Electron window do not block desktop clicks, dynamically enabling/disabling interaction based on cursor position over interactive elements.
    -   **Full-window canvas:** Items can be dragged and resized anywhere within the visible application window.

**Features:**
-   **Sample Board:** Quick creation of a demo board with pre-filled cards.
-   **Duplicate:** Clones any card, including media blobs.
-   **Lock:** Prevents dragging and resizing of cards.
-   **Export/Import JSON:** Allows saving and loading board layouts with validation.

## External Dependencies
-   **React:** JavaScript library for building user interfaces.
-   **Vite:** Next-generation frontend tooling for fast development.
-   **react-rnd:** A React component for draggable and resizable elements.
-   **localStorage:** Web Storage API for local data persistence.
-   **IndexedDB:** Low-level API for client-side storage of large amounts of structured data.
-   **Electron:** Framework for building desktop applications with web technologies (optional, for desktop target).