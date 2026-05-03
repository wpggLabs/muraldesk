# MuralDesk Agent Rules

You are helping build MuralDesk, a local-first desktop visual mural layer.

## Product Vision

MuralDesk lets users place images, videos, smart embeds, links, and notes onto a transparent overlay that floats over their real desktop — and as a PWA in the browser. It's a quiet, ambient visual layer for references and inspiration, not a generic notes app, not a wallpaper engine, not a bookmark manager.

## Hard preservation rules

The following behaviors are load-bearing. Do not change them without an explicit, scoped request that names the file:

- **Electron transparent overlay** behavior (`electron/main.cjs`, `electron/preload.cjs`) — `transparent: true`, frameless, no-shadow, secure preload bridge with `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, `webSecurity: true`. Tray + hide-to-tray + before-quit / will-quit logic.
- **Click-through behavior** (`src/hooks/useElectronClickThrough.js`) — renderer hit-test that flips `setIgnoreMouseEvents` per cursor position. Cards interactive; empty space passes mouse events to the OS.
- **Desktop Mode** (`src/hooks/useDesktopMode.js` + the IPC it talks to) — current-display and all-displays overlay modes; persisted to `localStorage`; replayed on launch.
- **Local-first persistence** — `localStorage` for layout (`muraldesk-board`), IndexedDB for media blobs (`muraldesk` / `media`). Hydration token + cancellation logic in `useBoard.js`.
- **Backup / export / import** (`src/lib/backup.js`) — `.muraldesk.json` portable format with embedded base64 media, layout-only Export, auto-detecting Import, link-URL re-sanitization on restore.
- **Link safety contract** (`src/lib/linkType.js` + `LinkCard.jsx`) — `http(s)` only, per-provider host allow-lists, strict ID/slug regex per embed provider. Unsafe protocols stripped on paste *and* on import.
- **PWA layer** (`public/manifest.webmanifest`, `public/sw.js`) — app-shell precache; the service worker must never intercept `blob:` / `data:` URLs (IndexedDB-backed object URLs must keep working).
- **Web/PWA build behavior** — the same board must continue to run cleanly in a normal browser tab without an Electron bridge.

## Non-negotiables

- **No backend, no login, no cloud sync** unless the user *explicitly* asks for it. Local-first is the product.
- **No telemetry / analytics / phone-home** of any kind.
- **No broad refactors.** Make small, surgical changes.
- **Do not touch `package.json`** unless the user explicitly asks for a dependency change. Don't bump majors casually.
- **Do not redesign the whole app** without permission.

## Code rules

- Small, scoped edits. Don't refactor unrelated files.
- Keep components simple; avoid unnecessary dependencies.
- Don't break working features to improve style.
- Honor existing patterns (custom hooks, hover-only mini-toolbars, theme tokens).

## Priority

1. Working desktop overlay + click-through.
2. Local-first persistence (don't break it).
3. Smart embeds + safe link handling.
4. Clean, ambient UI.
5. Buildathon-ready demo polish.
