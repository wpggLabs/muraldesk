import { useCallback, useEffect, useState } from 'react'

// Board-level view preferences. Lives in its own localStorage key so it
// is completely independent of:
//   - `muraldesk-board` (layout) owned by useBoard
//   - `muraldesk-snap`        owned by useSnap
//   - IndexedDB media blobs   owned by mediaStore
// None of those modules read or write this key, and this hook never
// reads or writes any of theirs. Both can be wiped or rewritten without
// affecting the other.
//
// Single JSON-serialized object (vs. raw strings like useSnap) because
// this hook owns multiple correlated fields and a future addition (e.g.
// a board tint, a "dim items not selected" mode) shouldn't require a new
// localStorage key.
const STORAGE_KEY = 'muraldesk-view'

// Allowed board-opacity steps. Cycle button advances to the next step
// and wraps. Match the per-item OPACITY_STEPS in BoardItem so visually
// the two systems use the same dot-fill icons (●/◕/◐/◔). 100% means
// "no board fade applied" — the multiplier is exactly 1, so the
// untouched render path is byte-identical to pre-feature behavior.
export const BOARD_OPACITY_STEPS = [1, 0.75, 0.5, 0.3]

const DEFAULT_VIEW = Object.freeze({ boardOpacity: 1, focusMode: false })

// Map an opacity in 0..1 to a single-glyph fill icon, picking the
// nearest step bucket (favors the higher value when between two).
// Exported so Toolbar can render the cycle button's icon to match
// the current value at a glance.
export function boardOpacityIcon(o) {
  if (o >= 0.875) return '●' // 100%
  if (o >= 0.625) return '◕' // 75%
  if (o >= 0.4)   return '◐' // 50%
  return '◔'                  // 30%
}

function clampOpacity(n) {
  // Defensive: clamp to (0, 1] so a stray import / hand-edited
  // localStorage value can't drive items invisible (0 would hide every
  // pinned item including those at item.opacity = 1 — making the board
  // appear empty with no obvious way out).
  if (typeof n !== 'number' || !isFinite(n)) return 1
  if (n <= 0.05) return 0.05
  if (n >= 1) return 1
  return n
}

function loadView() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_VIEW }
    const parsed = JSON.parse(raw)
    return {
      boardOpacity: clampOpacity(parsed && parsed.boardOpacity),
      focusMode: !!(parsed && parsed.focusMode),
    }
  } catch {
    // localStorage can throw in private mode / sandboxed iframes, and
    // JSON.parse can throw on a corrupted value. Fall back to defaults
    // (board fully opaque, focus off) — matching the spec's "default
    // off" / "no fade" expectations.
    return { ...DEFAULT_VIEW }
  }
}

function saveView(v) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(v))
  } catch {
    // Same reason as loadView — silent no-op on quota / sandbox
    // failures. The setting will simply not persist this session.
  }
}

// Returns { boardOpacity, focusMode, cycleBoardOpacity,
//          setBoardOpacity, toggleFocusMode }. Single hook so App.jsx
// has one place to wire the view-layer state, and so the persisted
// JSON shape stays atomic (a single setItem per change, not two).
export function useBoardView() {
  const [view, setView] = useState(loadView)

  useEffect(() => {
    saveView(view)
  }, [view])

  const cycleBoardOpacity = useCallback(() => {
    setView((prev) => {
      const idx = BOARD_OPACITY_STEPS.findIndex(
        (s) => Math.abs(s - prev.boardOpacity) < 0.001,
      )
      // If the current value isn't one of our steps (e.g. an external
      // hand-edit), fall back to step 0 so the next click goes to 0.75.
      const next = BOARD_OPACITY_STEPS[
        (idx === -1 ? 0 : idx + 1) % BOARD_OPACITY_STEPS.length
      ]
      return { ...prev, boardOpacity: next }
    })
  }, [])

  const setBoardOpacity = useCallback((next) => {
    setView((prev) => ({ ...prev, boardOpacity: clampOpacity(next) }))
  }, [])

  const toggleFocusMode = useCallback(() => {
    setView((prev) => ({ ...prev, focusMode: !prev.focusMode }))
  }, [])

  return {
    boardOpacity: view.boardOpacity,
    focusMode: view.focusMode,
    cycleBoardOpacity,
    setBoardOpacity,
    toggleFocusMode,
  }
}
