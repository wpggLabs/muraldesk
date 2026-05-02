// Preload runs before the renderer starts. It is the only place where
// privileged APIs can be safely exposed to the page via contextBridge.
//
// We expose a small `window.muraldesk` object so the renderer can:
//   1. detect that it's running inside the Electron shell (vs the
//      browser/PWA build), to conditionally show desktop-only UI;
//   2. drive Desktop Canvas Mode (toggle / set fullscreen);
//   3. observe fullscreen-state changes that originate outside the app
//      (OS-level Esc on macOS, F11, multi-monitor moves, etc).
//
// Nothing here gives the renderer Node.js access. contextIsolation +
// sandbox stay on; the renderer only talks to main via the named IPC
// channels listed below.

const { contextBridge, ipcRenderer } = require('electron')

const FULLSCREEN_CHANNEL = 'desktop:fullscreen-changed'

contextBridge.exposeInMainWorld('muraldesk', {
  isElectron: true,
  platform: process.platform,
  setFullscreen: (on) => ipcRenderer.invoke('desktop:set-fullscreen', !!on),
  toggleFullscreen: () => ipcRenderer.invoke('desktop:toggle-fullscreen'),
  isFullscreen: () => ipcRenderer.invoke('desktop:is-fullscreen'),
  // Desktop Mode display selection: 'current' (cover the monitor the
  // window is on) or 'all' (cover the bounding rect of every connected
  // monitor — single span window). The renderer's localStorage is the
  // source of truth; this call mirrors the value to main so the next
  // setFullscreen(true) — or an in-progress overlay — uses it. Anything
  // other than the literal string 'all' is normalized to 'current' on
  // both sides of the bridge.
  setDisplayMode: (mode) => ipcRenderer.invoke(
    'desktop:set-display-mode',
    mode === 'all' ? 'all' : 'current',
  ),
  onFullscreenChange: (cb) => {
    if (typeof cb !== 'function') return () => {}
    const handler = (_event, value) => {
      try { cb(!!value) } catch { /* ignore listener errors */ }
    }
    ipcRenderer.on(FULLSCREEN_CHANNEL, handler)
    return () => ipcRenderer.removeListener(FULLSCREEN_CHANNEL, handler)
  },
  // Frameless-window controls. With `frame: false` the OS chrome is gone,
  // so the renderer needs an explicit way to minimize / close. These are
  // the only IPC channels that can mutate window state besides fullscreen.
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  // Click-through for the transparent overlay. Pass `{ forward: true }`
  // when ignoring so the renderer keeps receiving mousemove events and
  // can flip click-through back off the moment the cursor enters an
  // interactive zone. The opts object is sanitized in main.
  setIgnoreMouseEvents: (ignore, opts) => ipcRenderer.invoke(
    'window:set-ignore-mouse-events',
    !!ignore,
    opts && typeof opts === 'object' ? { forward: !!opts.forward } : undefined,
  ),
  // Returns {x, y} in the renderer's content-area client coords, or
  // null if unavailable. Used by useElectronClickThrough on mount to
  // run a real hit-test against the current cursor position before
  // any mousemove event has arrived, so the initial click-through
  // state is always correct.
  getCursorPositionInWindow: () => ipcRenderer.invoke(
    'window:get-cursor-position-in-window',
  ),
})
