# MuralDesk

A local-first visual desktop pinboard built with React and Vite. Users can pin images, videos, notes, and links onto a canvas-style board, drag/resize/duplicate/lock them, and the layout (plus media binaries) is saved automatically on the user's machine.

## Architecture

- **Frontend only** — no backend, no auth, no cloud, no payments
- **React + Vite** — port 5000, host 0.0.0.0, deployment target is static (`vite build` → `dist/`)
- **react-rnd** — for drag and resize of board items
- **Local-only persistence** — `localStorage` for layout, IndexedDB for media blobs
- **Installable PWA** — manifest + basic app-shell service worker; SW only registers in production builds

## Project Structure

```
public/
  manifest.webmanifest — PWA manifest (name, short_name, theme_color #0f0f10, icons, standalone)
  icon.svg             — Primary app icon (gradient + stylized cards)
  icon-maskable.svg    — Maskable icon variant for adaptive launchers
  sw.js                — Service worker: app-shell cache (cache-first assets, network-first nav)
src/
  App.jsx              — Root: canvas, selection state, keyboard shortcuts, handlers, footer
  main.jsx             — Entry point; calls registerServiceWorker()
  registerSW.js        — Registers /sw.js only in PROD; unregisters any stale SW in dev
  index.css            — Global CSS variables and reset
  lib/
    mediaStore.js      — IndexedDB wrapper for image/video blob persistence
    sampleBoard.js     — Builder for the demo "Sample board" (4 cards)
  hooks/
    useBoard.js        — Board state: localStorage layout + IDB media hydration,
                          add/update/remove/duplicate/import/export
  components/
    Toolbar.jsx        — Top toolbar: Image, Video, Note, Link · Sample, Export, Import · Clear
    BoardItem.jsx      — Wrapper with drag/resize/lock/duplicate/delete via react-rnd
    ImageCard.jsx      — Image display card
    VideoCard.jsx      — Video player card (loop, mute controls)
    NoteCard.jsx       — Editable text note card with color swatches
    LinkCard.jsx       — URL link card with favicon and Open button (http/https only — defensive)
    EmptyState.jsx     — Shown when board is empty: pitch + Sample CTA + Add note + keyboard hint
    Footer.jsx         — Bottom-center "Local-first · No account · Offline storage" trust text
```

## Persistence (do not touch without explicit reason)

- **Layout (positions, sizes, note text, link metadata, lock flag, z-index)** → `localStorage` key `muraldesk-board`. Saved on every state change.
- **Image / video binaries** → IndexedDB (`muraldesk` db, `media` store), keyed by item id. The card's transient `blob:` `src` is stripped before persisting layout, then re-created via `URL.createObjectURL` when items hydrate on mount.
- Object URLs are revoked on item removal, board clear, import-replace, and unmount to avoid leaks.
- Hydration is cancellable so React 18 StrictMode's double-mount doesn't leak URLs.
- If `saveBlob` fails (quota / private mode), the card is added without a `mediaId` so it stays session-only rather than persisting a broken reference.
- `duplicateItem` for media items copies the IDB blob to a fresh id (independent of the original); rolls back the IDB write if URL creation fails.
- `importLayout` deletes IDB entries that are no longer referenced by the new layout, then re-hydrates referenced media; uses an import token so a slow hydrate from an older import can't patch stale state.

## Polish features (buildathon demo)

- **Selection** — click a card to select; visible accent outline + glow.
- **Keyboard shortcuts** — `Esc` deselects, `Delete` / `Backspace` removes the selected card. Skipped while focus is in an `input`, `textarea`, or `contentEditable` so note editing isn't broken.
- **Sample board** — one click adds 4 demo cards (welcome note, tips note, gradient SVG image, mood-board link).
- **Duplicate (⧉)** — clones any card; for media items it copies the IDB blob to a fresh id.
- **Lock (🔒/🔓)** — locked cards can't be dragged or resized.
- **Export / Import JSON** — round-trips layout. Import is capped at 5 MB / 500 items, validates structure, and sanitizes link URLs (drops `javascript:` and other non-http(s) protocols).
- **Footer** — subtle bottom-center trust text.

## PWA notes

- Manifest, icons, and service worker live in `public/` so Vite serves them at the site root verbatim.
- `registerServiceWorker()` is a no-op in dev (and proactively unregisters any leftover SW) so HMR + hydration of IndexedDB media stay rock-solid while iterating.
- The SW only intercepts same-origin GETs for the static app shell. It explicitly skips `blob:` / cross-origin / `/@vite` / `/@react-refresh` / `/__replco/` URLs, so it never touches the IndexedDB-backed `blob:` URLs that drive image and video cards.
- Cache name is versioned (`muraldesk-shell-v1`); bump it on releases to force shell refresh.

## Dev

```bash
npm run dev     # starts on port 5000 (no service worker)
npm run build   # production build → dist/ (PWA assets included)
npm run preview # serve dist/ locally to test the installable PWA + offline shell
```
