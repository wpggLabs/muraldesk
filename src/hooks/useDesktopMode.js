import { useCallback, useEffect, useState } from 'react'

// Desktop Canvas Mode is an Electron-only "immersive" view: the OS-level
// window goes fullscreen and the toolbar auto-hides so the canvas fills
// the entire monitor like a desktop mural layer.
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
// main process (window-state.json in userData) — not here.

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

  // Subscribe to web Fullscreen API changes (works in both targets — in
  // Electron the OS fullscreen does NOT trigger document.fullscreenChange,
  // so we also subscribe to the Electron bridge below).
  useEffect(() => {
    function onChange() {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  // Subscribe to OS-level fullscreen changes coming from the Electron
  // main process (e.g. user pressed F11 / OS hotkey, or exited fullscreen
  // via the green traffic-light button on macOS).
  useEffect(() => {
    if (!bridge) return
    let mounted = true
    bridge.isFullscreen().then((v) => { if (mounted) setIsFullscreen(!!v) }).catch(() => {})
    const off = bridge.onFullscreenChange((v) => {
      setIsFullscreen(!!v)
      // If the OS dropped us out of fullscreen, also drop desktopMode so
      // the toolbar reappears and the toggle stays in sync.
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
  // session, ask the Electron window to enter fullscreen again.
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
