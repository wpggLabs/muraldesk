import { useCallback, useEffect, useState } from 'react'

// Desktop Canvas Mode is an Electron-only "immersive" view: the
// BrowserWindow expands (via setBounds(display.bounds) in the main
// process — see electron/main.cjs `enterOverlayDisplay`) to cover the
// FULL bounds of whichever monitor MuralDesk is currently on, so
// pinned items can be dragged anywhere across that display while the
// window stays a regular, transparent, non-fullscreen overlay. The
// toolbar auto-hides so the canvas fills the entire monitor like a
// desktop mural layer.
//
// The IPC channel names (`bridge.setFullscreen` / `toggleFullscreen` /
// `isFullscreen` / `onFullscreenChange`) are kept from the original
// OS-fullscreen implementation for backwards compatibility — they
// drive the overlay-display behavior now, not native fullscreen.
// "Fullscreen" in this hook therefore always means "overlay covering
// current display" in Electron.
//
// On the web/PWA build there is no `window.muraldesk` bridge, so:
//   - `isElectron` is false
//   - `desktopMode` always stays false
//   - `toggleFullscreen` falls back to the browser's Fullscreen API so
//     the Ctrl/Cmd+Shift+F shortcut still does *something* useful in a
//     normal browser tab.
//
// `desktopMode` is persisted to localStorage so the user's preference
// survives reload, but window geometry is persisted by the Electron
// main process (window-state.json in userData) — not here, and the
// overlay rect itself is NEVER persisted (see `inOverlayDisplay`
// gating in main.cjs).

const STORAGE_KEY = 'mural.desktopMode'

function getBridge() {
  if (typeof window === 'undefined') return null
  return window.muraldesk && window.muraldesk.isElectron ? window.muraldesk : null
}

function readStoredDesktopMode() {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function writeStoredDesktopMode(on) {
  try {
    if (on) localStorage.setItem(STORAGE_KEY, '1')
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // localStorage may be unavailable in private mode; non-fatal.
  }
}

export function useDesktopMode() {
  const bridge = getBridge()
  const isElectron = !!bridge

  const [isFullscreen, setIsFullscreen] = useState(() => {
    if (typeof document === 'undefined') return false
    return !!document.fullscreenElement
  })
  const [desktopMode, setDesktopModeState] = useState(() =>
    isElectron ? readStoredDesktopMode() : false,
  )

  // Subscribe to web Fullscreen API changes. Only relevant on the
  // web/PWA build — in Electron the overlay-display mode does not use
  // the web Fullscreen API at all (and the OS-level fullscreen
  // listeners were removed from main.cjs), so this effect is a no-op
  // there. We still wire it up unconditionally so the same hook
  // works in both targets.
  useEffect(() => {
    function onChange() {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  // Subscribe to overlay-mode changes coming from the Electron main
  // process. `bridge.isFullscreen()` returns `inOverlayDisplay` (the
  // single source of truth for Desktop Mode); `onFullscreenChange`
  // fires when enterOverlayDisplay / exitOverlayDisplay run.
  useEffect(() => {
    if (!bridge) return
    let mounted = true
    bridge.isFullscreen().then((v) => { if (mounted) setIsFullscreen(!!v) }).catch(() => {})
    const off = bridge.onFullscreenChange((v) => {
      setIsFullscreen(!!v)
      // If overlay mode was exited (from any path — toolbar button,
      // toggle, or future programmatic exit), keep desktopMode in
      // sync so the toolbar's toggle reflects reality.
      if (!v) {
        setDesktopModeState(false)
        writeStoredDesktopMode(false)
      }
    })
    return () => {
      mounted = false
      off && off()
    }
  }, [bridge])

  // Re-apply desktopMode on launch: if the user had it enabled last
  // session, ask the Electron window to re-enter overlay mode.
  useEffect(() => {
    if (!bridge) return
    if (!desktopMode) return
    bridge.setFullscreen(true).catch(() => {})
    // We intentionally only run this effect once on mount; toggling
    // desktopMode at runtime is handled by `toggleDesktopMode` below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggleFullscreen = useCallback(async () => {
    if (bridge) {
      try { await bridge.toggleFullscreen() } catch { /* ignore */ }
      return
    }
    if (typeof document === 'undefined') return
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {})
    } else {
      document.documentElement.requestFullscreen?.().catch(() => {})
    }
  }, [bridge])

  const setDesktopMode = useCallback(async (on) => {
    if (!bridge) return // no-op on web
    const next = !!on
    setDesktopModeState(next)
    writeStoredDesktopMode(next)
    try { await bridge.setFullscreen(next) } catch { /* ignore */ }
  }, [bridge])

  const toggleDesktopMode = useCallback(() => {
    setDesktopMode(!desktopMode)
  }, [desktopMode, setDesktopMode])

  return {
    isElectron,
    isFullscreen,
    toggleFullscreen,
    desktopMode,
    setDesktopMode,
    toggleDesktopMode,
  }
}
