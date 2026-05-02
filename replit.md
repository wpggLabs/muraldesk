# MuralDesk

## Overview
MuralDesk is a local-first, visual desktop pinboard application built with React and Vite. It allows users to pin various media types (images, videos, notes, links) onto a canvas-style board. Key features include drag, resize, duplicate, and lock functionalities for pinned items. All user data, including layout and media binaries, is automatically saved locally on the user's machine, ensuring privacy and offline access. The project aims to provide a highly interactive and persistent digital workspace without relying on any backend, authentication, or cloud services.

## User Preferences
I want iterative development.
Ask before making major changes.
Do not make changes to the persistence section.

## System Architecture
MuralDesk is a frontend-only application using React and Vite, designed for static deployment.
The UI/UX is designed as a full-viewport canvas where items render directly. Items appear as free-floating objects without permanent borders or headers, revealing controls (outline, mini-toolbar for lock/duplicate/delete) only on hover/select. A floating pill toolbar is located at the top-center for main actions (add items, export, import, fullscreen) and auto-dims when not in use.

**Key Technical Implementations:**
- **Drag and Resize:** Implemented using `react-rnd`.
- **Local Persistence:** `localStorage` is used for layout data (positions, sizes, text, metadata, lock status, z-index), while `IndexedDB` stores image and video binary large objects (blobs). Object URLs are revoked to prevent memory leaks.
- **PWA Capabilities:** Includes a web manifest and a basic app-shell service worker for installability and offline access, registering only in production builds.
- **Card Types:**
    - **ImageCard:** Displays images.
    - **VideoCard:** Plays videos with hover-only mute/loop controls.
    - **NoteCard:** Editable text notes with hover-only color swatches.
    - **LinkCard:** Smartly classifies and renders links as YouTube embeds, videos, images, web previews (favicon, title, description), or an "unsafe URL" placeholder. YouTube and video links have `pointer-events:none` by default for easy dragging, with an "Interact" mode to enable native player controls.
- **Selection & Interaction:** Items can be selected with a click, showing an accent outline. Keyboard shortcuts like `Esc` to deselect and `Delete`/`Backspace` to remove are supported.
- **Desktop Target (Electron):** An optional Electron shell provides a desktop application experience, sharing the same renderer. It includes a "Desktop Canvas Mode" for an immersive, full-screen experience and persists window state (position, size) locally. IPC between the renderer and main process is minimal and secured with `contextIsolation` and `sandbox` enabled.
    - **Transparent overlay mode (Electron only):** the Electron build creates its `BrowserWindow` with `transparent: true`, `frame: false`, `hasShadow: false`, `backgroundColor: '#00000000'`. The renderer flips a `data-electron="true"` attribute on `<html>` so `src/index.css` paints `html / body / #root` transparent, App.jsx skips its dark canvas background / ambient gradient / grid / empty-state hero, and only the floating toolbar pill plus pinned items remain visible over the user's desktop. The web/PWA build is untouched and keeps the original dark canvas. The toolbar pill is also the OS window-drag handle (`-webkit-app-region: drag`) since the frame is gone; each button opts out with `no-drag`. Frameless-window controls (minimize / close) are exposed via `window.muraldesk.minimizeWindow()` / `closeWindow()` (IPC channels `window:minimize` / `window:close`) and shown as compact buttons at the right end of the toolbar in Electron.
    - **Toolbar visibility (Electron):** force-shown when the board is empty, then auto-hides once the first item exists (opacity 0 + `pointer-events: none` + slide up). Re-appears when the cursor is within ~24 px of the top, the toolbar is hovered, any pinned item is hovered (App lifts hover state from `BoardItem.onHoverChange`), or a dialog is open. The web build retains its original always-present-but-dimming toolbar.
    - **Dev ports:** the web/PWA dev server runs on **5000** (`npm run dev` / `dev:web`, host `0.0.0.0`, used by the Replit preview). The Electron renderer has its own dedicated dev server on **5173** with `--strictPort` (`npm run dev:renderer`), so it can never silently drift to a different port if 5000 is busy. `npm run dev:desktop` runs `dev:renderer` and starts Electron with `ELECTRON_RENDERER_URL=http://localhost:5173`.
    - **Replit limitation:** Electron itself cannot launch in the default Replit container — Chromium needs GUI system libraries (GTK/GLib: `libgobject-2.0.so.0`, `libgtk-3.so.0`, …) that are not installed here, so `npm run dev:desktop` and `npm run build:desktop` will fail with a `cannot open shared object file` error. Use Replit for editing and for the web build (`npm run dev:web` / `build:web`); test the Electron shell on a Windows / macOS / Linux desktop machine where those libraries are standard. Linux desktops without a compositing window manager will render the "transparent" window opaque; Windows 10/11 and macOS render it correctly.

**Features:**
- **Sample Board:** Quick creation of a demo board with pre-filled cards.
- **Duplicate:** Clones any card, including copying media blobs for media items.
- **Lock:** Prevents dragging and resizing of cards.
- **Export/Import JSON:** Allows saving and loading board layouts, with import validation and URL sanitization.

## External Dependencies
- **React:** JavaScript library for building user interfaces.
- **Vite:** Next-generation frontend tooling for fast development.
- **react-rnd:** A React component for draggable and resizable elements.
- **localStorage:** Web Storage API for local data persistence.
- **IndexedDB:** Low-level API for client-side storage of large amounts of structured data.
- **Electron:** Framework for building desktop applications with web technologies (optional, for desktop target).