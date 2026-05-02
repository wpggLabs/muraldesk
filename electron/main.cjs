// Electron main process for MuralDesk.
//
// Responsibilities:
// - Create a single BrowserWindow that hosts the existing renderer
//   (the React app built by Vite into ./dist).
// - In development, load the Vite dev server URL so HMR works.
// - In production (packaged), load the static dist/index.html via file://.
// - Open external http(s) links in the user's default browser instead of
//   navigating away from the app.
// - Force the renderer into a sandboxed, contextIsolated browser context.
//   The renderer has no Node access; the app is purely localStorage +
//   IndexedDB and does not need any native APIs yet.

const { app, BrowserWindow, shell } = require('electron')
const path = require('node:path')

const isDev = !app.isPackaged

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0f0f10',
    title: 'MuralDesk',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  })

  // Don't paint a white flash before the renderer is ready.
  win.once('ready-to-show', () => win.show())

  if (isDev) {
    const devUrl = process.env.ELECTRON_RENDERER_URL || 'http://localhost:5000'
    win.loadURL(devUrl)
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  // Any anchor with target="_blank" or window.open() that points at an
  // http(s) URL opens in the OS default browser. Anything else is denied.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  // Prevent in-app navigation away from the app shell. External links go
  // through setWindowOpenHandler above instead. We compare parsed URL
  // origins (not string prefixes) so something like
  // `http://localhost:5000.evil.com` cannot masquerade as the dev server.
  const devOrigin = (() => {
    try {
      return new URL(process.env.ELECTRON_RENDERER_URL || 'http://localhost:5000').origin
    } catch {
      return 'http://localhost:5000'
    }
  })()
  win.webContents.on('will-navigate', (event, url) => {
    let origin = ''
    try { origin = new URL(url).origin } catch { /* ignore */ }
    const allowed = isDev && origin === devOrigin
    if (!allowed) {
      event.preventDefault()
      if (url.startsWith('http://') || url.startsWith('https://')) {
        shell.openExternal(url)
      }
    }
  })
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
