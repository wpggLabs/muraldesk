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

const { app, BrowserWindow, ipcMain, screen, shell, Tray, Menu, nativeImage } = require('electron')
const path = require('node:path')
const fs = require('node:fs')

const isDev = !app.isPackaged

// ---- System tray state -----------------------------------------------------
//
// MuralDesk's window is transparent + click-through, so the tray is the
// user's primary, always-reachable handle on the app: show / hide / toggle
// Desktop Mode / quit. Module-scoped so the tray menu's click handlers
// always operate on the current main window (which can be re-created on
// macOS dock reactivation), and so other lifecycle hooks can reach the
// `isQuitting` flag without juggling closures.
//
// `isQuitting` distinguishes "user closed the window" (intercept → hide
// to tray) from "user really wants to quit" (Quit menu, before-quit, OS
// shutdown). The close interceptor checks this flag.
//
// `trayMenuRefresh` is set by createTray() to a closure that rebuilds the
// context menu, so we can keep the "Toggle Desktop Mode" label in sync
// with the live overlay state regardless of whether the toggle came from
// the renderer or the tray itself.
let tray = null
let isQuitting = false
let trayMenuRefresh = null

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
  // Reset overlay-mode module state. inOverlayDisplay / prevWindowBounds /
  // prevMaximized are module-scoped (so the IPC handlers can reach them
  // without juggling closure refs), but they describe ONE specific
  // BrowserWindow's lifecycle. On macOS the user can quit all windows and
  // reopen via the dock (`activate` event below), which calls createWindow
  // again — without this reset, a brand-new window could inherit
  // `inOverlayDisplay=true` from the previous, now-destroyed window and
  // become permanently unable to persist its geometry.
  inOverlayDisplay = false
  prevWindowBounds = null
  prevMaximized = false

  const stored = clampToDisplays(loadWindowState())

  // Transparent overlay window:
  //   - `transparent: true` makes the BrowserWindow's background see-through
  //     (the renderer's html/body/#root must also be transparent — see
  //     `[data-electron="true"]` rules in src/index.css).
  //   - `frame: false` removes the OS title bar / chrome so the only
  //     visible thing is the floating toolbar pill and pinned items.
  //   - `hasShadow: false` removes the OS-level drop shadow that would
  //     otherwise outline the (now-invisible) window rectangle.
  //   - `backgroundColor: '#00000000'` is a fully-transparent ARGB color;
  //     Electron requires this to be transparent (or omitted) when the
  //     window itself is `transparent: true`.
  // Platform notes:
  //   - Windows 10/11: works; window is still resizable from the edges
  //     (no visible cursor change because the frame is gone).
  //   - macOS: works; we draw our own close/minimize buttons in the
  //     toolbar instead of the standard traffic-lights.
  //   - Linux: depends on the compositor — most modern WMs (GNOME,
  //     KDE) render transparency correctly; tiling WMs without a
  //     compositor will fall back to opaque.
  const win = new BrowserWindow({
    width: stored.width,
    height: stored.height,
    x: stored.x,
    y: stored.y,
    minWidth: 900,
    minHeight: 600,
    transparent: true,
    frame: false,
    hasShadow: false,
    backgroundColor: '#00000000',
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
    // The desktop dev script (`npm run dev:desktop`) starts Vite on a
    // dedicated, --strictPort 5173 instance and sets ELECTRON_RENDERER_URL
    // explicitly, so this fallback only kicks in if someone launches
    // `electron .` by hand. Web dev (port 5000) is reserved for the
    // Replit preview / browser target.
    const devUrl = process.env.ELECTRON_RENDERER_URL || 'http://localhost:5173'
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
    // Don't overwrite the user's normal window geometry while we're
    // expanded to cover the whole display in overlay mode — the
    // resize/move events triggered by `setBounds(display.bounds)`
    // would otherwise clobber the saved "restore me here" rectangle.
    if (inOverlayDisplay) return
    if (win.isFullScreen()) return // also skip OS-level fullscreen as a defense in depth
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
  // Close handler: persist geometry first, then — if a tray is alive
  // and the user hasn't explicitly chosen to quit (Quit menu item /
  // app `before-quit`) — intercept the close and hide to tray instead
  // of destroying the window. This is what makes the toolbar's X
  // button and Alt+F4 / clicking the (frameless) close affordance
  // feel like "tucking away" the mural rather than tearing it down.
  // The user can always re-open via the tray icon click or the
  // tray menu's "Show MuralDesk" item; "Quit MuralDesk" sets
  // isQuitting and lets the close proceed normally.
  win.on('close', (e) => {
    persistGeometry()
    if (tray && !isQuitting && !win.isDestroyed()) {
      e.preventDefault()
      win.hide()
    }
  })

  // NOTE: we deliberately do NOT subscribe to `enter-full-screen` /
  // `leave-full-screen` events anymore. Desktop Mode is implemented as
  // a `setBounds(display.bounds)` overlay (see enterOverlayDisplay /
  // exitOverlayDisplay below) — it never enters OS-level fullscreen,
  // so those events would never fire from our code. If the OS DID
  // somehow trigger fullscreen externally (a global hotkey we don't
  // own, a tiling-WM rule, …) and we still mirrored that to
  // 'desktop:fullscreen-changed', the renderer's Desktop Mode toggle
  // would desync from `inOverlayDisplay` (the real ground truth) and
  // the toolbar would show the wrong state. Cleaner to ignore OS
  // fullscreen entirely and let `inOverlayDisplay` be the single
  // source of truth.

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
      return new URL(process.env.ELECTRON_RENDERER_URL || 'http://localhost:5173').origin
    } catch {
      return 'http://localhost:5173'
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
    // Clear overlay-mode state so a subsequent createWindow() (e.g.
    // macOS dock reactivation) starts fresh. createWindow itself
    // already resets these, but doing it on close as well guarantees
    // the invariant "inOverlayDisplay reflects a LIVE window" even if
    // some other code path peeks at it between close and re-create.
    inOverlayDisplay = false
    prevWindowBounds = null
    prevMaximized = false
  })

  return win
}

// ---- Desktop Canvas Overlay Mode (full-display transparent overlay) -------
//
// "Desktop Mode" used to call BrowserWindow.setFullScreen(true), which
// puts the OS into native fullscreen (animation, taskbar hide,
// space-of-its-own on macOS, …). That is NOT what we want for a
// transparent desktop overlay: we want the BrowserWindow itself to
// resize to cover the full physical bounds of the monitor MuralDesk
// is currently on, so pinned items can be dragged anywhere across the
// whole display, while the OS still treats us as a regular,
// resizable, non-fullscreen window. Transparency / frame-less /
// click-through all keep working because nothing about the window
// type changes — only its rectangle.
//
// Module-level state:
//   - inOverlayDisplay: whether we're currently expanded to a display.
//   - prevWindowBounds: the pre-overlay rect (in memory only — NEVER
//     persisted to window-state.json) so we can restore it on exit.
//   - prevMaximized: whether we were maximized; we unmaximize on
//     enter and re-maximize on exit if so.
//
// persistGeometry() is gated on `!inOverlayDisplay` so the full-
// display rect never clobbers the saved normal geometry.

let inOverlayDisplay = false
let prevWindowBounds = null
let prevMaximized = false

function emitOverlayChanged(win, on) {
  if (!win || win.isDestroyed()) return
  try {
    win.webContents.send('desktop:fullscreen-changed', !!on)
  } catch {
    // Renderer not ready yet; the renderer will sync via isFullscreen()
    // on its first IPC call after mount.
  }
  // Keep the tray menu's "Toggle Desktop Mode" label in sync. Cheap —
  // builds and assigns a small Menu template — and runs only when
  // overlay state actually flips.
  if (typeof trayMenuRefresh === 'function') {
    try { trayMenuRefresh() } catch { /* tray was destroyed mid-flip; ignore */ }
  }
}

function enterOverlayDisplay(win) {
  if (!win || win.isDestroyed()) return false
  if (inOverlayDisplay) return true
  // Capture the pre-overlay state in MEMORY ONLY. Do not write to
  // window-state.json — that file should only ever hold the user's
  // chosen normal window geometry.
  prevMaximized = win.isMaximized()
  // getNormalBounds returns the underlying restore rect if maximized;
  // fall back to the regular bounds otherwise.
  prevWindowBounds = prevMaximized
    ? (typeof win.getNormalBounds === 'function' ? win.getNormalBounds() : win.getBounds())
    : win.getBounds()
  // Find the display the window is currently "on" and expand to its
  // FULL physical bounds (not workArea — we want the overlay to cover
  // the taskbar / dock area too, since this is a real-estate overlay
  // for desktop mural use). screen.getDisplayMatching picks the
  // display with the largest intersection with the window rect.
  const display = screen.getDisplayMatching(win.getBounds())
  if (prevMaximized) win.unmaximize()
  // Set the flag BEFORE setBounds so the resize/move events that
  // immediately follow are correctly ignored by persistGeometry.
  inOverlayDisplay = true
  win.setBounds(display.bounds)
  // Lock the overlay in place: the toolbar pill is the OS window-drag
  // handle (`-webkit-app-region: drag`) so without setMovable(false)
  // the user could accidentally drag the entire overlay off-screen
  // when reaching for the toolbar. Resizing is also disabled — the
  // overlay should stay pinned to display bounds.
  win.setMovable(false)
  win.setResizable(false)
  emitOverlayChanged(win, true)
  return true
}

function exitOverlayDisplay(win) {
  if (!win || win.isDestroyed()) return false
  if (!inOverlayDisplay) return false
  win.setMovable(true)
  win.setResizable(true)
  // Restore the pre-overlay rect. If we somehow don't have one (which
  // shouldn't happen — enterOverlayDisplay always captures it), fall
  // back to a 1280x800 window centered on the current display.
  let restore = prevWindowBounds
  if (!restore) {
    const d = screen.getDisplayMatching(win.getBounds())
    const w = 1280
    const h = 800
    restore = {
      x: Math.round(d.bounds.x + (d.bounds.width - w) / 2),
      y: Math.round(d.bounds.y + (d.bounds.height - h) / 2),
      width: w,
      height: h,
    }
  }
  // Clear the flag BEFORE setBounds so the resize/move events that
  // follow are properly captured by persistGeometry — we want the
  // restored normal geometry to be saved.
  inOverlayDisplay = false
  win.setBounds(restore)
  if (prevMaximized) win.maximize()
  prevWindowBounds = null
  prevMaximized = false
  emitOverlayChanged(win, false)
  return true
}

// ---- IPC: Desktop Canvas Mode ---------------------------------------------
//
// The renderer drives Desktop Mode through `bridge.setFullscreen()` /
// `bridge.toggleFullscreen()` — historical names from when this used
// OS fullscreen. We keep the channel names so the renderer doesn't
// need to change, but the implementation now drives our overlay-
// display behavior described above.

ipcMain.handle('desktop:set-fullscreen', (event, on) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (!win || win.isDestroyed()) return false
  if (!!on) enterOverlayDisplay(win)
  else exitOverlayDisplay(win)
  return inOverlayDisplay
})

ipcMain.handle('desktop:toggle-fullscreen', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (!win || win.isDestroyed()) return false
  if (inOverlayDisplay) exitOverlayDisplay(win)
  else enterOverlayDisplay(win)
  return inOverlayDisplay
})

ipcMain.handle('desktop:is-fullscreen', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (!win || win.isDestroyed()) return false
  return inOverlayDisplay
})

// ---- IPC: window controls (frameless mode needs explicit min/close) -------

ipcMain.handle('window:minimize', (_event) => {
  const win = BrowserWindow.fromWebContents(_event.sender)
  if (!win || win.isDestroyed()) return false
  win.minimize()
  return true
})

ipcMain.handle('window:close', (_event) => {
  const win = BrowserWindow.fromWebContents(_event.sender)
  if (!win || win.isDestroyed()) return false
  win.close()
  return true
})

// Click-through for transparent areas. When `ignore` is true the OS
// passes mouse clicks through MuralDesk to whatever is behind it (the
// user's desktop / other apps). When `forward: true`, the renderer
// still receives mouse-MOVE events while ignoring clicks, which is how
// it can detect the cursor entering an interactive zone (toolbar,
// pinned item, dialog) and call back asking for click-through OFF.
//
// We resolve the BrowserWindow from event.sender, so a renderer can
// only flip click-through on its own host window — never on another
// MuralDesk window or an arbitrary BrowserWindow.
ipcMain.handle('window:set-ignore-mouse-events', (event, ignore, opts) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (!win || win.isDestroyed()) return false
  // Only honor the documented `forward` flag; reject arbitrary objects
  // so a misbehaving renderer can't smuggle unexpected options through.
  const safeOpts = opts && typeof opts === 'object' && opts.forward
    ? { forward: true }
    : undefined
  win.setIgnoreMouseEvents(!!ignore, safeOpts)
  return true
})

// Returns the OS cursor position translated into the renderer's
// content-area client coordinates (the coord system used by
// document.elementFromPoint). The renderer's click-through hook calls
// this exactly once on mount, so it can run a real hit-test against
// the current cursor position WITHOUT waiting for a mousemove event
// to arrive — otherwise the very first click after launching MuralDesk
// is racy: setting click-through ON pre-emptively breaks toolbar/card
// clicks if the cursor was already over them, while setting it OFF
// pre-emptively breaks desktop click-through if the cursor was over
// empty area. With a real hit-test we always start in the correct
// state. Returns null if the window is destroyed.
ipcMain.handle('window:get-cursor-position-in-window', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (!win || win.isDestroyed()) return null
  try {
    const cursor = screen.getCursorScreenPoint()
    const bounds = win.getContentBounds()
    return { x: cursor.x - bounds.x, y: cursor.y - bounds.y }
  } catch {
    return null
  }
})

// ---- System tray -----------------------------------------------------------
//
// All tray menu handlers resolve the live window via the module-level
// `mainWindow` rather than a captured argument, because `mainWindow` can
// be re-created (e.g. macOS dock reactivation after window-all-closed),
// and we want the tray to keep working across that lifecycle.
//
// If tray creation fails — e.g. headless Linux, missing icon file,
// platform without StatusItem support — we log and leave `tray = null`.
// The close handler's `if (tray && ...)` gate then no-ops, so the user
// always gets normal close behavior as a fallback. There is no path
// where the user gets "stuck" with no way to quit.

function showMainWindow() {
  // If the window was hidden to tray, restore-and-focus. If it was
  // destroyed (rare — only after explicit quit attempts that didn't
  // complete), re-create it.
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow()
    return
  }
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

function hideMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.hide()
}

function toggleDesktopModeFromTray() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    // No live window — show one first, then enter overlay on the next tick.
    createWindow()
    if (mainWindow) {
      mainWindow.once('ready-to-show', () => enterOverlayDisplay(mainWindow))
    }
    return
  }
  // The overlay is meaningless on a hidden window (the user wouldn't see
  // it). Surface the window first, then toggle.
  if (!mainWindow.isVisible()) showMainWindow()
  if (inOverlayDisplay) exitOverlayDisplay(mainWindow)
  else enterOverlayDisplay(mainWindow)
}

function buildTrayMenu() {
  return Menu.buildFromTemplate([
    { label: 'Show MuralDesk', click: showMainWindow },
    { label: 'Hide MuralDesk', click: hideMainWindow },
    { type: 'separator' },
    {
      // Label reflects the live overlay state so the user always sees
      // the action they'd be taking. emitOverlayChanged() rebuilds the
      // menu whenever this flips from any source.
      label: inOverlayDisplay ? 'Exit Desktop Mode' : 'Enter Desktop Mode',
      click: toggleDesktopModeFromTray,
    },
    { type: 'separator' },
    {
      label: 'Quit MuralDesk',
      click: () => {
        // Mark the quit as user-initiated so the close interceptor
        // lets the window actually close instead of hiding to tray.
        isQuitting = true
        app.quit()
      },
    },
  ])
}

function createTray() {
  // Load the bundled tray icon. `electron/tray-icon.png` is a 32x32 RGBA
  // PNG with a transparent background and a MuralDesk-purple rounded
  // square; on macOS the OS auto-templates it for dark/light menu bars.
  //
  // If the icon is missing or unreadable, we INTENTIONALLY refuse to
  // create the tray and return null. Reason: the close button hides
  // to tray when `tray` is truthy, so creating an invisible/empty
  // tray would strand the user — they can't see the tray icon to
  // re-open or quit, and the close button no longer quits either.
  // Returning null here makes the close handler fall through to the
  // OS default (= quit on non-macOS), which always leaves the user
  // a way out.
  const iconPath = path.join(__dirname, 'tray-icon.png')
  let image = null
  try {
    image = nativeImage.createFromPath(iconPath)
  } catch {
    image = null
  }
  if (!image || image.isEmpty()) {
    console.warn('MuralDesk: tray icon missing or empty at', iconPath, '— tray disabled, close button will quit normally.')
    return null
  }

  const t = new Tray(image)
  t.setToolTip('MuralDesk')
  t.setContextMenu(buildTrayMenu())

  // Keep the menu's "Enter / Exit Desktop Mode" label in sync with
  // overlay state. Stored module-globally so emitOverlayChanged() can
  // call it without needing a reference to `t`.
  trayMenuRefresh = () => {
    if (t.isDestroyed && t.isDestroyed()) return
    try { t.setContextMenu(buildTrayMenu()) } catch { /* tray gone; ignore */ }
  }

  // Single-click on tray (Windows / Linux convention) toggles visibility.
  // On macOS this fires for left-click on the menu-bar icon; the context
  // menu is also reachable via the standard right-click / two-finger
  // tap, so behavior matches platform expectations.
  t.on('click', () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      showMainWindow()
      return
    }
    if (mainWindow.isVisible() && !mainWindow.isMinimized()) {
      // Already up — bring to front (helps when MuralDesk was visible
      // but behind another app).
      mainWindow.focus()
    } else {
      showMainWindow()
    }
  })

  return t
}

// ---- App lifecycle ---------------------------------------------------------

app.whenReady().then(() => {
  createWindow()
  // Tray creation is best-effort. createTray() returns null if the
  // icon file is missing/empty (so we don't create an invisible tray
  // that would strand the user); the constructor can also throw on
  // platforms without a status-area concept (some headless Linux
  // environments). In either case `tray` stays null and the close
  // handler gracefully falls back to default close (= quit) behavior,
  // guaranteeing the user always has a way to exit.
  try {
    tray = createTray()
  } catch (err) {
    console.warn('MuralDesk: could not create system tray.', err)
    tray = null
  }
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
    else showMainWindow()
  })
})

// With a tray icon, MuralDesk is intentionally a "background" app: the
// close button hides to tray and the process stays alive so the tray
// menu remains reachable. Without a tray (creation failed, or no tray
// support on this platform) we fall back to the original behavior:
// quit on last window close everywhere except macOS.
app.on('window-all-closed', () => {
  if (process.platform === 'darwin') return
  if (tray && !isQuitting) return
  app.quit()
})

// Set the quit flag for ALL legitimate quit triggers — Cmd+Q on macOS,
// the tray's "Quit MuralDesk" item, OS shutdown / logout, an explicit
// `app.quit()` call, etc. The window's close handler reads this flag
// to decide whether to hide-to-tray or actually close.
app.on('before-quit', () => {
  isQuitting = true
})

app.on('will-quit', () => {
  // Destroy the tray ourselves so the OS doesn't briefly orphan a
  // tray icon during shutdown. Setting it to null also makes any
  // late-firing close events fall through to default behavior.
  if (tray) {
    try { tray.destroy() } catch { /* ignore */ }
    tray = null
  }
  trayMenuRefresh = null
})
