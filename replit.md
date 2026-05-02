# MuralDesk

## Overview
MuralDesk is a local-first, visual desktop pinboard application built with React and Vite. It allows users to pin various media types (images, videos, notes, links) onto a canvas-style board with functionalities like drag, resize, duplicate, and lock. All user data, including layout and media binaries, is saved locally on the user's machine, ensuring privacy and offline access without relying on backend services. The project aims to provide an intuitive and private digital workspace.

## User Preferences
I want iterative development.
Ask before making major changes.
Do not make changes to the persistence section.

## System Architecture
MuralDesk is a frontend-only application using React and Vite, designed for static deployment. The UI/UX features a full-viewport canvas where items appear as free-floating objects, revealing controls only on hover/selection. A floating pill toolbar at the top-center provides main actions and auto-dims when not in use.

**UI/UX Decisions:**
- Full-viewport canvas for free-floating items.
- Controls visible only on hover/selection of items.
- Floating pill toolbar for main actions, with auto-dimming.
- Optional snap-to-grid with alignment guides.
- Theming support for dark/light modes and accent colors.
- Board-level opacity and Focus Mode for enhanced visibility control.

**Technical Implementations:**
-   **Drag and Resize:** Implemented using `react-rnd`.
-   **Local Persistence:** `localStorage` for layout data; `IndexedDB` for image and video blobs.
-   **PWA Capabilities:** Web manifest and basic app-shell service worker for installability and offline access.
-   **Card Types:** ImageCard, VideoCard, NoteCard, and LinkCard (smartly classifies and renders links).
-   **Export/Import:** Supports quick layout export and portable backup export (including media blobs) with auto-detection of format.
-   **Branding:** Centralized icon management from a single SVG source (`public/icon.svg`) for various platforms and resolutions, generated via ImageMagick.
-   **Selection & Interaction:** Click-to-select, with keyboard shortcuts for deselection and removal.

**Desktop Target (Electron):**
-   Optional Electron shell for a desktop application experience.
-   **Transparent Overlay Mode:** Uses a transparent, frameless window to float items over the desktop.
-   **Desktop Canvas Mode:** Expands to cover the entire physical monitor, allowing items to be dragged across displays.
-   **System Tray:** Provides control (hide, show, quit) especially in transparent click-through mode.
-   **Keyboard Shortcuts:** Electron-specific shortcuts for desktop mode, toolbar visibility, and adding items.
-   **Click-through:** Transparent empty areas do not block desktop clicks, with dynamic interaction enabling/disabling.
-   **Full-window canvas:** Items can be dragged and resized anywhere within the application window.
-   **Startup Options:** Configurable launch behaviors like `launchOnStartup`, `startMinimized`, and `startInDesktopMode` via a tray menu.

## External Dependencies
-   **React:** JavaScript library for building user interfaces.
-   **Vite:** Next-generation frontend tooling.
-   **react-rnd:** React component for draggable and resizable elements.
-   **localStorage:** Web Storage API for local data persistence.
-   **IndexedDB:** Client-side storage for large structured data.
-   **Electron:** Framework for building desktop applications (optional desktop target).