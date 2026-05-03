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
- Floating pill toolbar for main actions, with auto-dimming. **Compact mode** (`src/components/Toolbar.jsx`) is forced ON whenever `isElectron` is true (regardless of viewport width) and on web below the 1500 px breakpoint. In compact mode the wordmark hides and every advanced action (Tidy / Export / Backup / Import / Display / Snap / Board / Focus / Theme / Accent / Shortcuts / Fullscreen / Clear) moves into a single **More** popover, leaving the always-visible row as: Image · Video · Note · Link · Sample · More · Desktop/Exit Desktop · Min · Close (the last three Electron-only).
- Optional snap-to-grid with alignment guides.
- Theming support for dark/light modes and accent colors.
- Board-level opacity and Focus Mode for enhanced visibility control.

**Technical Implementations:**
-   **Drag and Resize:** Implemented using `react-rnd`.
-   **Local Persistence:** `localStorage` for layout data; `IndexedDB` for image and video blobs.
-   **PWA Capabilities:** Web manifest and basic app-shell service worker for installability and offline access.
-   **Card Types:** ImageCard, VideoCard, NoteCard, and LinkCard. **LinkCard smart embeds** classify a user-supplied URL via `src/lib/linkType.js#classifyLink` and render one of: YouTube, Vimeo, SoundCloud, Spotify, CodePen, direct video (`.mp4|.webm|.ogg|.ogv|.mov|.m4v`), inline image (`.jpg|.png|.gif|.webp|.svg|.avif|.apng|.bmp`), plain Web (favicon + Open button), or "Unsafe URL" placeholder. **Safety contract** applies to every branch: (a) URL must parse via `new URL()`; (b) protocol must be `http:` or `https:` — `javascript:`, `data:`, `file:`, `mailto:`, `vbscript:`, `ftp:`, `ws:`, etc. all → `unsafe`; (c) host must match a per-provider allow-list (no wildcards); (d) the id / slug used to BUILD the embed URL is validated against a strict regex (digits / base62 / `[\w-]`), and the embed URL is assembled from the validated pieces — never by string-concat of the raw input. Any validation failure falls through to a plain web Open card, never a half-built embed. **URL→embed mapping:** YouTube (`youtube.com`/`m.`/`music.`/`youtube-nocookie`/`youtu.be`) → `youtube-nocookie.com/embed/<id>?autoplay=1&mute=1&loop=1&modestbranding=1&rel=0`; Vimeo (`vimeo.com`/`player.vimeo.com`) → `player.vimeo.com/video/<id>?autoplay=1&muted=1&loop=1&background=1&dnt=1`; SoundCloud (`soundcloud.com`/`m.soundcloud.com` only — `on.` redirector and `w.` embed-origin are excluded) for `/<user>/<track>` or `/<user>/sets/<set>` → `w.soundcloud.com/player/?url=<encoded canonical>&auto_play=false&hide_related=true&visual=true`; Spotify (`open.spotify.com`/`spotify.com`, locale prefix `/intl-xx/` stripped) for content types `track|album|playlist|episode|show|artist` with strict 22-char base62 IDs → `open.spotify.com/embed/<type>/<id>`; CodePen (`codepen.io`) for `/<user>/{pen|details|full|debug}/<slug>` → `codepen.io/<user>/embed/<slug>?default-tab=result&editable=false&theme-id=dark`. **Iframe-level defenses** (applied to every NEW embed via the shared `IframeEmbed` component in `src/components/LinkCard.jsx`; YouTubeEmbed is intentionally left byte-identical to its pre-feature implementation): `referrerPolicy="strict-origin-when-cross-origin"`, `sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-presentation"` (deliberately NO `allow-forms`/`allow-modals`/`allow-top-navigation*`/`allow-downloads`/`allow-pointer-lock`/`allow-orientation-lock`/`allow-storage-access-by-user-activation`), and a per-platform `allow=` feature-policy enumerating ONLY what the player needs (e.g. SoundCloud `autoplay; encrypted-media`, Spotify `autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture`, CodePen `clipboard-write`). **Interact mode** (same UX pattern as YouTube) is shared by all five embed kinds: idle = `pointer-events: none` (whole card drags from anywhere), Interact = `pointer-events: auto` plus a 26-px drag strip at the top of the iframe so the user can still reposition. Esc exits while parent has focus; explicit "✕ Exit interact" stays reachable when the iframe steals key focus. **Persistence is automatic** — `item.url` is the only stored field; classification re-runs at render time so export/import round-trips embeds with no schema change. `lib/backup.js`'s `sanitize()` already strips non-http(s) link items on both export and import. **Default sizes** (`defaultLinkSize`): YouTube/Vimeo/direct-video 360×220; SoundCloud track 360×200, set 360×300; Spotify track/episode 320×100 (compact), album/playlist/show/artist 320×380; CodePen 480×300; image 280×220; plain web 280×160.
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