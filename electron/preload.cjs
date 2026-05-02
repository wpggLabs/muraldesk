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
  onFullscreenChange: (cb) => {
    if (typeof cb !== 'function') return () => {}
    const handler = (_event, value) => {
      try { cb(!!value) } catch { /* ignore listener errors */ }
    }
    ipcRenderer.on(FULLSCREEN_CHANNEL, handler)
    return () => ipcRenderer.removeListener(FULLSCREEN_CHANNEL, handler)
  },
})
