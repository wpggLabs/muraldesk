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
// Persisted Desktop-Mode display selection. 'current' (default) covers
// the monitor the window is on; 'all' spans the full virtual desktop
// via a single overlay BrowserWindow. Renderer is the source of truth;
// the Electron main process mirrors via the `setDisplayMode` IPC.
const STORAGE_KEY_DISPLAY_MODE = 'mural.displayMode'

function readStoredDisplayMode() {
  try {
    const v = localStorage.getItem(STORAGE_KEY_DISPLAY_MODE)
    return v === 'all' ? 'all' : 'current'
  } catch {
    return 'current'
  }
}

function writeStoredDisplayMode(mode) {
  try {
    if (mode === 'all') localStorage.setItem(STORAGE_KEY_DISPLAY_MODE, 'all')
    else localStorage.removeItem(STORAGE_KEY_DISPLAY_MODE)
  } catch {
    // localStorage may be unavailable in private mode; non-fatal.
  }
}

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
  // Display selection. Always 'current' on the web build (web has no
  // multi-monitor overlay concept); the value is read from localStorage
  // only in Electron. Pushed to main on launch via the effect below.
  const [displayMode, setDisplayModeState] = useState(() =>
    isElectron ? readStoredDisplayMode() : 'current',
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

  // Replay persisted state on launch:
  //   1. Push the stored displayMode to main FIRST, awaited, so when
  //      step 2 fires main has the correct mirror in place and
  //      enterOverlayDisplay computes the right rect on first try.
  //   2. If desktopMode was on last session, re-enter overlay mode.
  // Sequenced via async IIFE so we don't rely on undocumented IPC
  // ordering across distinct invoke calls.
  useEffect(() => {
    if (!bridge) return
    let cancelled = false
    ;(async () => {
      try { await bridge.setDisplayMode(displayMode) } catch { /* ignore */ }
      if (cancelled) return
      if (desktopMode) {
        try { await bridge.setFullscreen(true) } catch { /* ignore */ }
      }
    })()
    return () => { cancelled = true }
    // We intentionally only run this effect once on mount; toggling
    // desktopMode / displayMode at runtime is handled by their
    // respective setters below.
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

  // Display mode setter. Updates local state + localStorage immediately,
  // then mirrors to main. If we're currently in overlay mode, main will
  // call reapplyOverlayBounds and the window resizes to the new rect
  // without exiting/re-entering Desktop Mode. No-op on the web build.
  const setDisplayMode = useCallback(async (mode) => {
    const next = mode === 'all' ? 'all' : 'current'
    setDisplayModeState(next)
    writeStoredDisplayMode(next)
    if (bridge) {
      try { await bridge.setDisplayMode(next) } catch { /* ignore */ }
    }
  }, [bridge])

  const toggleDisplayMode = useCallback(() => {
    setDisplayMode(displayMode === 'all' ? 'current' : 'all')
  }, [displayMode, setDisplayMode])

  return {
    isElectron,
    isFullscreen,
    toggleFullscreen,
    desktopMode,
    setDesktopMode,
    toggleDesktopMode,
    displayMode,
    setDisplayMode,
    toggleDisplayMode,
  }
}
