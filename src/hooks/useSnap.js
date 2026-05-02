import { useCallback, useEffect, useState } from 'react'

// Snap-to-grid preference. Lives in its own localStorage key so it is
// completely independent of `muraldesk-board` (the layout key owned by
// useBoard) — this hook never reads or writes the board data, and the
// board persistence module never reads or writes this preference. Both
// can be wiped or rewritten without affecting the other.
//
// Stored as raw 'on' / 'off' strings (not JSON.stringify(boolean)) so a
// future schema bump can use a richer string vocabulary (e.g. 'soft',
// 'hard', 'dense') without breaking the parser.
const STORAGE_KEY = 'muraldesk-snap'

// Grid size in CSS pixels. 24 chosen because:
//   - It divides evenly into all default card sizes
//     (120, 180, 220, 280, 300, 360 — every minimum / spawn size).
//   - It's coarse enough to feel like a deliberate snap (1-frame jump
//     when crossing a gridline) but fine enough that a careful user
//     can place items precisely (24 px ≈ 0.6 cm on a 96-DPI display).
//   - It matches the 12-step CSS spacing rhythm used elsewhere in the
//     design tokens, so snapped layouts visually align with toolbar
//     paddings and card mini-toolbar placements.
export const SNAP_GRID = 24

function loadSnap() {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'on'
  } catch {
    // localStorage can throw in private mode / sandboxed iframes.
    // Snap defaults to OFF on read failure, matching the spec.
    return false
  }
}

function saveSnap(on) {
  try {
    localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off')
  } catch {
    // Same reason as loadSnap — silently no-op on quota / sandbox
    // failures. The setting will simply not persist this session.
  }
}

// Returns { snap, setSnap, toggleSnap, gridSize }. The grid size is
// exported as part of the hook surface so consumers (BoardItem) don't
// have to import the constant separately, keeping the snap subsystem
// in a single import path.
export function useSnap() {
  const [snap, setSnapState] = useState(loadSnap)

  useEffect(() => {
    saveSnap(snap)
  }, [snap])

  const setSnap = useCallback((next) => {
    setSnapState(!!next)
  }, [])

  const toggleSnap = useCallback(() => {
    setSnapState((prev) => !prev)
  }, [])

  return { snap, setSnap, toggleSnap, gridSize: SNAP_GRID }
}
