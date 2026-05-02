# MuralDesk

A visual desktop pinboard app built with React and Vite. Users can pin images, videos, notes, and links onto a canvas-style board, drag/resize them, and their layout is saved automatically via localStorage.

## Architecture

- **Frontend only** — no backend needed, all state saved in `localStorage`
- **React + Vite** — port 5000, host 0.0.0.0
- **react-rnd** — for drag and resize of board items

## Project Structure

```
src/
  App.jsx              — Root component, board canvas, handlers
  main.jsx             — Entry point
  index.css            — Global CSS variables and reset
  lib/
    mediaStore.js      — IndexedDB wrapper for image/video blob persistence
  hooks/
    useBoard.js        — Board state, localStorage layout + IDB media hydration
  components/
    Toolbar.jsx        — Top toolbar: add image, video, note, link, clear
    BoardItem.jsx      — Wrapper with drag/resize/delete via react-rnd
    ImageCard.jsx      — Image display card
    VideoCard.jsx      — Video player card (loop, mute controls)
    NoteCard.jsx       — Editable text note card with color swatches
    LinkCard.jsx       — URL link card with favicon and open button
    EmptyState.jsx     — Shown when board is empty
```

## Persistence

- **Layout (positions, sizes, note text, link metadata, z-index)** → `localStorage` key `muraldesk-board`. Saved on every state change.
- **Image / video binaries** → IndexedDB (`muraldesk` db, `media` store), keyed by item id. The card's transient `blob:` `src` is stripped before persisting layout, then re-created via `URL.createObjectURL` when items hydrate on mount.
- Object URLs are revoked on item removal, board clear, and unmount to avoid leaks. Hydration is cancellable so React 18 StrictMode's double-mount doesn't leak URLs.
- If `saveBlob` fails (quota / private mode), the card is added without a `mediaId`, so it stays session-only rather than persisting a broken reference.

## Features

- Add local images and videos from disk
- Add text notes (double-click to edit, color swatches)
- Add link cards (URL, title, description)
- Drag items freely on the canvas
- Resize items with corner/edge handles
- Delete items by hovering and clicking X
- Board layout auto-saved to localStorage
- Video auto-play, loop toggle, mute toggle
- Grid background canvas aesthetic

## Dev

```bash
npm run dev     # starts on port 5000
npm run build   # production build
```
