// Electron main process for MuralDesk.
//
// Responsibilities:
// - Create a single BrowserWindow that hosts the existing renderer
//   (the React app built by Vite into ./dist).
// - In development, load the Vite dev server URL so HMR works.
// - In production (packaged), load the static dist/index.html via file://.
// - Persist window position / size / maximized state across launches.
// - Expose a tiny IPC surface so the renderer can drive Desktop Canvas
//   Mode (fullscreen toggle + observe fullscreen state) via the preload
//   bridge in ./preload.cjs.
// - Open external http(s) links in the user's default browser instead of
//   navigating away from the app.
// - Force the renderer into a sandboxed, contextIsolated browser context.

const { app, BrowserWindow, ipcMain, screen, shell } = require('electron')
const path = require('node:path')
const fs = require('node:fs')

const isDev = !app.isPackaged

// ---- Window state persistence ----------------------------------------------
//
// We keep a tiny JSON file in the user-data folder remembering the last
// known window geometry so MuralDesk reopens where the user left it.
// Maximized state is preserved separately because a maximized window's
// `getBounds()` returns the maximized rectangle, not the underlying
// "restore" rectangle, and we only want to maximize again if the user
// closed it maximized.

const STATE_FILE = path.join(app.getPath('userData'), 'window-state.json')
const DEFAULT_STATE = { width: 1280, height: 800, x: undefined, y: undefined, isMaximized: false }

function loadWindowState() {
  try {
    const raw = fs.readFileSync(STATE_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    if (typeof parsed !== 'object' || !parsed) return { ...DEFAULT_STATE }
    return {
      width: Number.isFinite(parsed.width) ? parsed.width : DEFAULT_STATE.width,
      height: Number.isFinite(parsed.height) ? parsed.height : DEFAULT_STATE.height,
      x: Number.isFinite(parsed.x) ? parsed.x : undefined,
      y: Number.isFinite(parsed.y) ? parsed.y : undefined,
      isMaximized: !!parsed.isMaximized,
    }
  } catch {
    return { ...DEFAULT_STATE }
  }
}

function saveWindowState(state) {
  try {
    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true })
    fs.writeFileSync(STATE_FILE, JSON.stringify(state), 'utf8')
  } catch {
    // Persistence is best-effort. Failing here must not crash the app.
  }
}

// Clamp a stored rectangle so it stays inside one of the currently
// connected displays. Without this, a window restored after a monitor
// was unplugged could end up off-screen.
function clampToDisplays(state) {
  const displays = screen.getAllDisplays()
  if (state.x === undefined || state.y === undefined) return state
  const fits = displays.some((d) => {
    const a = d.workArea
    return (
      state.x >= a.x - 50 &&
      state.y >= a.y - 50 &&
      state.x + state.width <= a.x + a.width + 50 &&
      state.y + state.height <= a.y + a.height + 50
    )
  })
  if (!fits) return { ...state, x: undefined, y: undefined }
  return state
}

// ---- Window creation -------------------------------------------------------

let mainWindow = null

function createWindow() {
  const stored = clampToDisplays(loadWindowState())

  const win = new BrowserWindow({
    width: stored.width,
    height: stored.height,
    x: stored.x,
    y: stored.y,
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

  mainWindow = win

  if (stored.isMaximized) win.maximize()

  // Don't paint a white flash before the renderer is ready.
  win.once('ready-to-show', () => win.show())

  if (isDev) {
    const devUrl = process.env.ELECTRON_RENDERER_URL || 'http://localhost:5000'
    win.loadURL(devUrl)
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  // Persist geometry on resize / move (debounced) and on close.
  let saveTimer = null
  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(persistGeometry, 400)
  }
  function persistGeometry() {
    if (win.isDestroyed()) return
    if (win.isFullScreen()) return // don't capture fullscreen rect as the restore rect
    const isMax = win.isMaximized()
    const bounds = isMax ? win.getNormalBounds?.() || win.getBounds() : win.getBounds()
    saveWindowState({
      width: Math.round(bounds.width),
      height: Math.round(bounds.height),
      x: Math.round(bounds.x),
      y: Math.round(bounds.y),
      isMaximized: isMax,
    })
  }
  win.on('resize', scheduleSave)
  win.on('move', scheduleSave)
  win.on('maximize', scheduleSave)
  win.on('unmaximize', scheduleSave)
  win.on('close', persistGeometry)

  // Notify the renderer when fullscreen state changes (including OS-level
  // exits like Esc on macOS) so the toolbar can keep its toggle in sync.
  function emitFs() {
    if (!win.isDestroyed()) {
      win.webContents.send('desktop:fullscreen-changed', win.isFullScreen())
    }
  }
  win.on('enter-full-screen', emitFs)
  win.on('leave-full-screen', emitFs)

  // External links → OS default browser. Internal navigation away from
  // the app shell is blocked.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  // Compare parsed URL origins so something like
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

  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null
  })

  return win
}

// ---- IPC: Desktop Canvas Mode ---------------------------------------------

ipcMain.handle('desktop:set-fullscreen', (_event, on) => {
  const win = BrowserWindow.fromWebContents(_event.sender)
  if (!win || win.isDestroyed()) return false
  win.setFullScreen(!!on)
  return win.isFullScreen()
})

ipcMain.handle('desktop:toggle-fullscreen', (_event) => {
  const win = BrowserWindow.fromWebContents(_event.sender)
  if (!win || win.isDestroyed()) return false
  win.setFullScreen(!win.isFullScreen())
  return win.isFullScreen()
})

ipcMain.handle('desktop:is-fullscreen', (_event) => {
  const win = BrowserWindow.fromWebContents(_event.sender)
  if (!win || win.isDestroyed()) return false
  return win.isFullScreen()
})

// ---- App lifecycle ---------------------------------------------------------

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
