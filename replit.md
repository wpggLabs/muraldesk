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
- **Export / Import — two paths, one Import button:** the toolbar exposes both a quick layout export and a portable backup export; a single Import button auto-detects which format it's reading. (a) **Quick Export (`↧`):** `useBoard.exportLayout()` returns `{version:1, app, exportedAt, items}` — item metadata only (media items keep `mediaId` but no `src`). Compact, fully restorable only on the SAME browser. Filename `muraldesk-layout-<stamp>.json`. (b) **Backup Export (`📦`):** `src/lib/backup.js#buildBackup` walks the items, reads each `mediaId`'s blob from IndexedDB, encodes it as base64, and emits `{app, kind:'backup', version:1, exportedAt, items, media:{[mediaId]:{mime,size,data}}}`. Filename `muraldesk-backup-<stamp>.muraldesk.json`. (c) **Import (`↥`):** parses the file, calls `isBackupPayload(parsed)` — if `kind==='backup'` and `media` is present, runs `restoreBackup(payload)` which writes each base64 blob back to IDB at its original `mediaId`, **then** calls the existing `useBoard.importLayout(items)` whose existing `hydrateMediaSrcs` step rebuilds `src` URLs from the now-populated IDB exactly as on first load; otherwise falls back to the legacy layout-only path (5 MB / 500 items). Persistence pipeline (localStorage for metadata, IndexedDB for blobs) is **unmodified** — `useBoard.js` and `mediaStore.js` are untouched. Size limits live in `src/lib/backup.js`: `MAX_BLOB_BYTES = 25 MB` per file (items above this get their `mediaId` stripped and exported metadata-only — no dangling reference on restore), `WARN_TOTAL_BYTES = 50 MB` total raw blob bytes (confirm() before download), `MAX_TOTAL_BYTES = 100 MB` (items past the cap in iteration order are exported metadata-only), `MAX_IMPORT_FILE_BYTES = 200 MB` on disk (rejected before parsing). Base64 inflates raw bytes by ~33%, factored into the on-disk-size warning. Both import paths share a `sanitize()` helper that strips non-http(s) protocols on link items so an imported `javascript:`/`data:` URL can never become a clickable href. Per-item `opacity`, `fit`, `locked`, `loop`, `muted`, etc. all round-trip through both export paths automatically because `buildBackup` and the layout export both spread the full item shape.
    -   **Per-item opacity + fit:** Each pinned item has an opacity setting and image/video items also have a fit setting (`'cover'` | `'contain'`), controlled via compact icon-buttons in the hover-only mini-toolbar.
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