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
  App.jsx              — Root: full-viewport canvas, selection state, keyboard shortcuts,
                          fullscreen toggle, ambient grid/glow background
  main.jsx             — Entry point; calls registerServiceWorker()
  registerSW.js        — Registers /sw.js only in PROD; unregisters any stale SW in dev
  index.css            — Global CSS variables and reset
  lib/
    mediaStore.js      — IndexedDB wrapper for image/video blob persistence
    sampleBoard.js     — Builder for the demo "Sample board" (4 cards)
    linkType.js        — Smart link classification: returns one of
                          { kind: 'youtube' | 'video' | 'image' | 'web' | 'unsafe' }
                          with a safe `youtube-nocookie.com/embed/{id}` URL for
                          YouTube. Only http(s) URLs are ever marked safe.
  hooks/
    useBoard.js        — Board state: localStorage layout + IDB media hydration,
                          add/update/remove/duplicate/import/export
  components/
    Toolbar.jsx        — Floating pill toolbar (top-center): Image, Video, Note, Link ·
                          Sample, Export, Import · Fullscreen · Clear. Auto-dims to ~32%
                          opacity when mouse leaves the top zone, full opacity on hover.
    BoardItem.jsx      — Free-floating item wrapper. NO permanent header / borders /
                          controls; subtle hover/select outline; floating mini-toolbar
                          (lock / duplicate / delete) appears top-right only on hover or
                          select. Whole item draggable except `.no-drag, textarea, input,
                          button, a, video` (forwarded to react-draggable via react-rnd's
                          `cancel` prop). Resize handles inside the wrapper at corners
                          (zIndex 25, above mini-toolbar) so corner clicks always resize.
    ImageCard.jsx      — Image display card
    VideoCard.jsx      — Video player; mute / loop controls bottom-left, hover-only.
                          Video has `pointer-events:none` so the whole video surface drags.
    NoteCard.jsx       — Editable text note. Color swatches top-left, hover-only.
                          Top padding (34px) leaves room for the floating mini-toolbar.
    LinkCard.jsx       — Smart link card. Picks one of four renderers via
                          `lib/linkType.js`:
                          * youtube → muted/looping `youtube-nocookie.com`
                            iframe. Default `pointer-events:none` so drag still
                            works. Hover shows a small "Interact" button; when
                            toggled on, the iframe becomes `pointer-events:auto`
                            (so the user can use the native YouTube player) and
                            a slim drag strip appears at the top of the card so
                            the item is still movable. Esc or the visible "Exit
                            interact" button exits the mode. Interact state is
                            transient React state — it is not persisted.
                          * video   → `<video>` with hover-only mute/loop
                            controls (mirrors uploaded VideoCard).
                          * image   → inline `<img>` with `pointer-events:none`.
                          * web     → favicon + title + description + Open
                            button (the original card design).
                          * unsafe  → "Unsafe URL" non-clickable placeholder.
                          Open anchor and hover controls all wear `.no-drag`.
    EmptyState.jsx     — Shown when board is empty: pitch + Sample CTA + Add note + keyboard hint.
```

## Persistence (do not touch without explicit reason)

- **Layout (positions, sizes, note text, link metadata, lock flag, z-index)** → `localStorage` key `muraldesk-board`. Saved on every state change.
- **Image / video binaries** → IndexedDB (`muraldesk` db, `media` store), keyed by item id. The card's transient `blob:` `src` is stripped before persisting layout, then re-created via `URL.createObjectURL` when items hydrate on mount.
- Object URLs are revoked on item removal, board clear, import-replace, and unmount to avoid leaks.
- Hydration is cancellable so React 18 StrictMode's double-mount doesn't leak URLs.
- If `saveBlob` fails (quota / private mode), the card is added without a `mediaId` so it stays session-only rather than persisting a broken reference.
- `duplicateItem` for media items copies the IDB blob to a fresh id (independent of the original); rolls back the IDB write if URL creation fails.
- `importLayout` deletes IDB entries that are no longer referenced by the new layout, then re-hydrates referenced media; uses an import token so a slow hydrate from an older import can't patch stale state.

## Canvas mode (current visual model)

The workspace is intentionally a near-empty mural rather than a typical app UI:

- **Full-viewport canvas** — items render directly into the root and use `bounds="parent"` so they can move anywhere in the visible viewport. There is no app header, no footer, no permanent panels.
- **Items look like free-floating objects** — no constant border, no header strip, no permanent type label. Default state is content + a soft drop shadow only.
- **Hover/select reveals everything** — a subtle 1-2px outline plus a small floating mini-toolbar (lock / duplicate / delete) at the top-right of the item. Note color swatches and video mute/loop controls also fade in on hover only.
- **Drag from anywhere** — the whole item is draggable except interactive bits. The exclusion list lives in `BoardItem.jsx` as `DRAG_CANCEL = '.no-drag, textarea, input, button, a, video'` and is forwarded via react-rnd's `cancel` prop. The mini-toolbar, note color picker, video controls, and link "Open" anchor all wear `.no-drag`.
- **Resize handles** — invisible by default, fade in with the same hover/select rule. Corner handles sit *inside* the wrapper at `right:0 / bottom:0` with `zIndex:25` (above the mini-toolbar at z:20) so corner clicks always start a resize, never a drag. Edge handles are 6px and offset slightly outside (`-3`).
- **Floating pill toolbar** — top-center, rounded 999px with backdrop blur. Includes a Fullscreen / Exit Fullscreen button (uses the Fullscreen API on `document.documentElement`; `fullscreenchange` listener keeps the label honest if the user hits Esc). Auto-dims to ~32% opacity when the mouse drifts below ~110px from the top.

## Polish features

- **Selection** — click a card to select; visible accent outline + glow.
- **Keyboard shortcuts** — `Esc` deselects, `Delete` / `Backspace` removes the selected card. Skipped while focus is in an `input`, `textarea`, or `contentEditable` so note editing isn't broken.
- **Sample board** — one click adds 4 demo cards (welcome note, tips note, gradient SVG image, mood-board link).
- **Duplicate (⧉)** — clones any card; for media items it copies the IDB blob to a fresh id.
- **Lock (🔒/🔓)** — locked cards can't be dragged or resized.
- **Export / Import JSON** — round-trips layout. Import is capped at 5 MB / 500 items, validates structure, and sanitizes link URLs (drops `javascript:` and other non-http(s) protocols).

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
