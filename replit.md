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
  hooks/
    useBoard.js        — Board state management + localStorage persistence
  components/
    Toolbar.jsx        — Top toolbar: add image, video, note, link, clear
    BoardItem.jsx      — Wrapper with drag/resize/delete via react-rnd
    ImageCard.jsx      — Image display card
    VideoCard.jsx      — Video player card (loop, mute controls)
    NoteCard.jsx       — Editable text note card with color swatches
    LinkCard.jsx       — URL link card with favicon and open button
    EmptyState.jsx     — Shown when board is empty
```

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
