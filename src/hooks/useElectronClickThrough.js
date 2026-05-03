import { useEffect, useRef } from 'react'

// Selector that identifies the parts of MuralDesk's UI that should
// remain interactive (capture clicks normally). Anything else inside
// the transparent window is click-through territory.
//
//   [data-muraldesk-interactive]  → the toolbar pill and the link dialog
//   .muraldesk-card-rnd           → react-rnd's outer wrapper for each
//                                   pinned card (set via Rnd's
//                                   `className` prop in BoardItem)
const INTERACTIVE_SELECTOR =
  '[data-muraldesk-interactive], .muraldesk-card-rnd'

/**
 * In the Electron transparent-overlay build, ask the main process to
 * flip BrowserWindow.setIgnoreMouseEvents on/off as the cursor moves
 * on and off interactive parts of the UI.
 *
 * Strategy:
 *   - On mount, ask the main process for the current OS cursor
 *     position translated into renderer client coords (via the
 *     `window:get-cursor-position-in-window` IPC). Run a real
 *     elementFromPoint hit-test at that position to set the initial
 *     click-through state correctly — without this, we'd be guessing
 *     and either the very first desktop click (if we default to OFF)
 *     or the very first toolbar/card click (if we default to ON)
 *     would be swallowed before any mousemove arrived to fix state.
 *     During the brief async window between mount and the IPC
 *     resolving (~10–30 ms), the window stays in its native default
 *     of "interactive" — that's the safer side of the tradeoff
 *     because losing a millisecond of desktop pass-through is
 *     invisible, while losing a millisecond of toolbar response
 *     would be felt.
 *   - On every mousemove, hit-test with document.elementFromPoint.
 *     If the topmost element belongs to an interactive zone, click-
 *     through is OFF; otherwise it's ON with `{ forward: true }` so
 *     mousemove keeps flowing into the renderer (otherwise once we
 *     turn click-through on we'd never hear about the cursor
 *     entering a card again).
 *   - While any mouse button is held (`e.buttons !== 0`) the hit-test
 *     is skipped entirely so an in-flight drag/resize gesture from
 *     react-rnd or a window-drag from the toolbar can never be
 *     aborted by a mid-gesture click-through flip. mouseup re-runs
 *     the hit-test so click-through engages immediately when the
 *     gesture ends over an empty area.
 *   - Diff the IPC: only send on transitions, not every mousemove.
 *
 * Web/PWA build is a no-op (no `window.muraldesk` bridge, hook simply
 * returns).
 */
export function useElectronClickThrough(isElectron) {
  // Track current OS-level state. Initialized to false because the
  // BrowserWindow itself is created with click-through OFF by Electron;
  // we'll immediately flip it ON below to match our renderer-side
  // expectation that empty transparent areas pass clicks through.
  const ignoringRef = useRef(false)

  useEffect(() => {
    if (!isElectron) return
    const bridge = typeof window !== 'undefined' ? window.muraldesk : null
    if (!bridge || typeof bridge.setIgnoreMouseEvents !== 'function') return

    function applyIgnore(nextIgnore) {
      if (ignoringRef.current === nextIgnore) return
      ignoringRef.current = nextIgnore
      try {
        // forward:true while ignoring keeps mousemove events flowing
        // so we can detect the cursor entering an interactive zone.
        bridge.setIgnoreMouseEvents(
          nextIgnore,
          nextIgnore ? { forward: true } : undefined,
        )
      } catch {
        // Bridge call failed (e.g. main process unreachable). Stay in
        // whatever state the window was in; don't crash the renderer.
      }
    }

    // Cancel pending async work on unmount so we never call
    // applyIgnore after the effect has been cleaned up.
    let cancelled = false

    // Run a real hit-test at the current OS cursor position before any
    // mousemove fires, so the initial click-through state is always
    // correct. Until this resolves the window stays in its native
    // "interactive" default (Electron's BrowserWindow ships with
    // setIgnoreMouseEvents(false) by default).
    function runHitTestAt(x, y) {
      const el = document.elementFromPoint(x, y)
      if (!el) {
        applyIgnore(true)
        return
      }
      const interactive = el.closest(INTERACTIVE_SELECTOR)
      applyIgnore(!interactive)
    }

    if (typeof bridge.getCursorPositionInWindow === 'function') {
      bridge.getCursorPositionInWindow().then((pos) => {
        if (cancelled) return
        if (
          pos &&
          typeof pos.x === 'number' &&
          typeof pos.y === 'number' &&
          // Only trust positions that land inside the viewport. A
          // negative or out-of-bounds value (cursor on a different
          // monitor, or sitting in the OS chrome) gets the same
          // treatment as elementFromPoint returning null: click-
          // through ON.
          pos.x >= 0 &&
          pos.y >= 0 &&
          pos.x < window.innerWidth &&
          pos.y < window.innerHeight
        ) {
          runHitTestAt(pos.x, pos.y)
        } else {
          applyIgnore(true)
        }
      }).catch(() => {
        // IPC failed; fall back to click-through ON which matches the
        // user's primary complaint ("clicks behind MuralDesk are
        // blocked"). Toolbar/card clicks still work as soon as the
        // cursor moves onto them.
        if (!cancelled) applyIgnore(true)
      })
    } else {
      // Older preload without the cursor-position bridge. Default to
      // click-through ON so empty-area desktop clicks still work.
      applyIgnore(true)
    }

    function onMove(e) {
      // While any mouse button is held the user is mid-gesture —
      // react-rnd is processing drag/resize mousemove deltas, or the
      // toolbar pill is being used as a window-drag handle. Flipping
      // the OS-level click-through to ON here, even briefly, would
      // yank events out from under the gesture and abort it (Electron
      // tested by the architect). Skip the hit-test entirely until
      // the button is released; the next button-up mousemove will
      // re-evaluate and restore the correct state.
      if (e.buttons !== 0) return

      // elementFromPoint can return null when the cursor is outside
      // the viewport, e.g. drifting off-window. Treat that as
      // "not over interactive" → click-through ON so the user can
      // immediately interact with whatever the cursor is now over.
      const el = document.elementFromPoint(e.clientX, e.clientY)
      if (!el) {
        applyIgnore(true)
        return
      }
      const interactive = el.closest(INTERACTIVE_SELECTOR)
      applyIgnore(!interactive)
    }

    // After a button is released we explicitly re-evaluate the
    // current cursor position, in case the gesture ended over a
    // non-interactive area (the user dragged a card off-canvas, lifted
    // the button, and now the cursor is hovering empty space — we
    // want click-through to engage immediately rather than wait for
    // the next idle mousemove tick).
    function onUp(e) {
      // Re-use the same hit-test logic by synthesizing a no-button
      // event: button has just been released so e.buttons should now
      // be 0, but be defensive in case some browsers fire mouseup
      // while another button is still held.
      if (e.buttons !== 0) return
      const el = document.elementFromPoint(e.clientX, e.clientY)
      if (!el) {
        applyIgnore(true)
        return
      }
      const interactive = el.closest(INTERACTIVE_SELECTOR)
      applyIgnore(!interactive)
    }

    window.addEventListener('mousemove', onMove, { passive: true })
    window.addEventListener('mouseup', onUp, { passive: true })

    return () => {
      cancelled = true
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      // On unmount / HMR, leave the window interactive. Otherwise a
      // hot-reload could orphan it in click-through mode and the user
      // wouldn't be able to click anything until the next mousemove.
      try {
        bridge.setIgnoreMouseEvents(false)
      } catch {
        /* ignore */
      }
      ignoringRef.current = false
    }
  }, [isElectron])
}
