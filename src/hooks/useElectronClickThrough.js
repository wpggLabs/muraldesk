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
 *   - Start with click-through OFF (the window is interactive on
 *     launch, so a user clicking the toolbar immediately works even
 *     before any mousemove is observed).
 *   - On every mousemove, hit-test with document.elementFromPoint.
 *     If the topmost element belongs to an interactive zone, click-
 *     through is OFF; otherwise it's ON with `{ forward: true }` so
 *     mousemove keeps flowing into the renderer (otherwise once we
 *     turn click-through on we'd never hear about the cursor entering
 *     a card again, and the window would stay click-through forever).
 *   - Diff the IPC: only send on transitions, not every mousemove.
 *
 * Web/PWA build is a no-op (no `window.muraldesk` bridge, hook simply
 * returns).
 */
export function useElectronClickThrough(isElectron) {
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

    // Default: window is interactive on mount. The first mousemove
    // will flip it to click-through if the cursor is over an empty
    // transparent area.
    applyIgnore(false)

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
