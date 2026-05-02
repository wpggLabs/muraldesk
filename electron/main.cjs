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

// ---- Startup settings ------------------------------------------------------
//
// Three Electron-only preferences exposed via the tray menu's Startup
// submenu (no IPC surface — the renderer never reads or writes these,
// keeping the bridge narrow per spec):
//
//   - launchOnStartup    → app.setLoginItemSettings({ openAtLogin })
//   - startMinimized     → keep the window hidden after launch (tray
//                          icon is the only affordance until user
//                          clicks it). Requires a live tray; if tray
//                          creation failed we fall back to showing
//                          normally so the user is never stranded.
//   - startInDesktopMode → call enterOverlayDisplay() in ready-to-show
//                          BEFORE win.show() so the user sees the
//                          overlay-sized window directly (no flash
//                          of normal-size first).
//
// Persisted as a sibling of window-state.json in userData. Best-effort
// I/O: a corrupt / unreadable file falls back to all-false defaults
// rather than crashing the launch path.
//
// `startupSettings` is module-scoped because:
//   - the IPC handlers (currently none, kept for future use) and the
//     tray menu click handlers both need read+write access without
//     juggling closure refs;
//   - createWindow's ready-to-show hook reads it to decide whether to
//     enter overlay / hide on launch;
//   - app.whenReady reads it to sync the OS-level login-item state.
//
// `startupHideActive` distinguishes "we're still in the initial launch
// tick and the user asked to start hidden" from "the user has explicitly
// surfaced the window since". macOS fires `activate` on initial launch
// (in addition to dock-clicks while running), and the default activate
// handler calls showMainWindow() which would defeat startMinimized.
// The flag prevents that. It is set PRE-EMPTIVELY in app.whenReady
// (before createWindow / tray creation) — not in ready-to-show — so
// that an activate event arriving between whenReady and ready-to-show
// (the precise window where the macOS race lives) is also caught.
// It clears on any explicit show (tray click, IPC, future surface)
// so subsequent activates behave normally, and ready-to-show clears
// it as a fallback if tray creation ended up failing (so a no-tray
// user is never stranded with an invisible window).

const STARTUP_FILE = path.join(app.getPath('userData'), 'startup-settings.json')
const DEFAULT_STARTUP = Object.freeze({
  launchOnStartup: false,
  startMinimized: false,
  startInDesktopMode: false,
})

let startupSettings = { ...DEFAULT_STARTUP }
let startupHideActive = false

function loadStartupSettings() {
  try {
    const raw = fs.readFileSync(STARTUP_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    if (typeof parsed !== 'object' || !parsed) return { ...DEFAULT_STARTUP }
    // Strict boolean validation: only the literals `true`/`false` are
    // accepted. Truthy non-boolean values like `'false'` (string), `1`,
    // `{}` would all coerce to `true` under `!!`, which would silently
    // promote a corrupted file into "everything enabled" — most
    // dangerous for `launchOnStartup` (registers a real OS login
    // item). Falling back to the default is safer and consistent
    // with the spec's "store preferences safely" requirement.
    return {
      launchOnStartup: typeof parsed.launchOnStartup === 'boolean'
        ? parsed.launchOnStartup
        : DEFAULT_STARTUP.launchOnStartup,
      startMinimized: typeof parsed.startMinimized === 'boolean'
        ? parsed.startMinimized
        : DEFAULT_STARTUP.startMinimized,
      startInDesktopMode: typeof parsed.startInDesktopMode === 'boolean'
        ? parsed.startInDesktopMode
        : DEFAULT_STARTUP.startInDesktopMode,
    }
  } catch {
    return { ...DEFAULT_STARTUP }
  }
}

function saveStartupSettings(s) {
  try {
    fs.mkdirSync(path.dirname(STARTUP_FILE), { recursive: true })
    fs.writeFileSync(STARTUP_FILE, JSON.stringify(s), 'utf8')
  } catch {
    // Persistence is best-effort. Failing here must not crash the app.
  }
}

// `app.setLoginItemSettings` is supported on Windows + macOS. On Linux
// the convention is an XDG `.desktop` autostart file (typically
// ~/.config/autostart/), which Electron does not provide a built-in
// helper for. Writing one ourselves correctly across distros (XDG
// paths, snap/flatpak sandboxing, CLI escape rules, dev vs packaged
// binary) is fragile, so we report the capability as unsupported on
// Linux and the tray menu shows the item as disabled with an
// "(unsupported)" suffix. The user's data is unaffected: the toggle
// persists in startup-settings.json and would re-activate if a future
// build adds Linux autostart support.
//
// Dev builds (Electron CLI) are also reported unsupported because
// setLoginItemSettings would register the generic `electron` binary
// itself — running it on next login would just open a blank Electron
// window, not MuralDesk. Packaging produces a real binary that this
// API can target meaningfully, so the capability flips to true once
// the user runs the packaged build.
function isLaunchOnStartupSupported() {
  if (isDev) return false
  return process.platform === 'win32' || process.platform === 'darwin'
}

function applyLoginItemSettings(on) {
  if (!isLaunchOnStartupSupported()) return false
  try {
    app.setLoginItemSettings({ openAtLogin: !!on })
    return true
  } catch (err) {
    console.warn('MuralDesk: setLoginItemSettings failed.', err)
    return false
  }
}

// Apply a partial patch to startupSettings: validate each field as a
// boolean (drop unknown fields and non-boolean values), persist on
// change, sync OS-level login-item state if launchOnStartup was in
// the patch, and rebuild the tray menu so checkmarks reflect the new
// state. Used by the tray submenu's click handlers — kept as a
// reusable function so any future IPC handler can reuse the exact
// same validation + side-effect pipeline.
function applyStartupPatch(patch) {
  if (!patch || typeof patch !== 'object') return startupSettings
  const next = { ...startupSettings }
  let changed = false
  if (typeof patch.launchOnStartup === 'boolean' && patch.launchOnStartup !== next.launchOnStartup) {
    next.launchOnStartup = patch.launchOnStartup
    changed = true
  }
  if (typeof patch.startMinimized === 'boolean' && patch.startMinimized !== next.startMinimized) {
    next.startMinimized = patch.startMinimized
    changed = true
  }
  if (typeof patch.startInDesktopMode === 'boolean' && patch.startInDesktopMode !== next.startInDesktopMode) {
    next.startInDesktopMode = patch.startInDesktopMode
    changed = true
  }
  if (!changed) return startupSettings
  startupSettings = next
  saveStartupSettings(next)
  if (typeof patch.launchOnStartup === 'boolean') {
    applyLoginItemSettings(next.launchOnStartup)
  }
  if (typeof trayMenuRefresh === 'function') {
    try { trayMenuRefresh() } catch { /* tray gone; ignore */ }
  }
  return startupSettings
}

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
  // BrowserWindow icon: shown in the taskbar, Alt-Tab switcher,
  // and (on Linux) the window manager. In packaged Windows builds
  // the .exe itself carries `build/icon.ico` (set via electron-builder
  // `win.icon`); this PNG is what Electron displays at runtime
  // before the OS-level shortcut/icon takes over, and is the
  // primary source on Linux. The file ships with the app because
  // `electron/**/*` is in the `files` glob.
  const winIcon = path.join(__dirname, 'icon.png')

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
    icon: winIcon,
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

  // Don't paint a white flash before the renderer is ready. Also the
  // single point where startup options take effect:
  //   1. startInDesktopMode: enter overlay BEFORE show so the window
  //      is sized to the display rect on first paint (no flash of
  //      normal-size window before it expands).
  //   2. startMinimized: skip win.show() entirely, leaving the window
  //      hidden behind the tray icon. Falls back to showing if tray
  //      creation failed (tray check ensures the user is never
  //      stranded with an invisible app and no way to recover it).
  // `startupHideActive` is set pre-emptively in app.whenReady (BEFORE
  // this hook ever fires) when the user has start-minimized enabled,
  // so the macOS `activate` event — which fires on initial launch in
  // addition to dock-click reopens — doesn't immediately auto-show
  // the window and defeat the user's "start hidden" intent during
  // the brief whenReady → ready-to-show window. The flag clears in
  // showMainWindow() the moment the user explicitly surfaces the
  // window via the tray; this hook never raises it (only conditionally
  // clears it in the tray-failure fallback path) to avoid re-asserting
  // a guard that the user has already overridden.
  win.once('ready-to-show', () => {
    if (startupSettings.startInDesktopMode) {
      try { enterOverlayDisplay(win) } catch { /* ignore */ }
    }
    const startHidden = startupSettings.startMinimized && !!tray
    if (startHidden) {
      // Window stays hidden. We deliberately do NOT re-assert
      // startupHideActive here, because the user may have already
      // explicitly surfaced the window via the tray during the brief
      // window between whenReady (where we pre-emptively set the
      // guard) and ready-to-show; in that case showMainWindow() has
      // already cleared the guard and re-asserting it would lock out
      // subsequent activate events even though the user's intent has
      // already shifted. The pre-emptive set in whenReady is the
      // ONLY place this flag is raised on launch; from there, only
      // user-initiated surfacing clears it.
      // (If win.isVisible() is true here it means showMainWindow ran
      // pre-ready-to-show; leave it visible.)
    } else {
      // Tray creation failed OR start-minimized is off: we MUST show
      // the window, otherwise a tray-failure user is stranded with an
      // invisible app and no tray icon. Also clear the pre-emptive
      // guard so subsequent activate events don't silently no-op.
      startupHideActive = false
      if (!win.isVisible()) win.show()
    }
  })

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
// Display selection for Desktop Mode:
//   'current' → cover the monitor the window is currently on (default).
//   'all'     → cover the bounding rectangle of every connected display
//               (the full virtual desktop) using a single span window.
// The renderer's localStorage `mural.displayMode` is the source of truth;
// main holds a mirror updated via the `desktop:set-display-mode` IPC so
// enterOverlayDisplay / reapplyOverlayBounds can read it synchronously.
// We deliberately do NOT reset this in createWindow: it's a session
// preference, not tied to a specific window's lifecycle.
//
// KNOWN LIMITATIONS of single-span "all displays":
//   - Non-rectangular monitor layouts (e.g. two monitors at different
//     heights, or an L-shape) produce "dead zones" inside the union
//     rect where no physical screen exists. The window region still
//     covers them, but nothing is visible there. Items dragged into a
//     dead zone keep their renderer-local coords (the board state is
//     fine) but the user can't see/grab them until they exit Desktop
//     Mode and the items reappear at their stored coords (which may
//     also be off-screen in the smaller normal window — at which
//     point they're recoverable by re-entering Desktop Mode in 'all'
//     mode and dragging back to a real display).
//   - Mixed-DPI multi-monitor setups: the BrowserWindow's content
//     scale follows whichever display the window's origin is on, so a
//     200% HiDPI monitor + 100% standard monitor will render the
//     200% half at "double size" relative to the renderer's logical
//     coords. This is a fundamental limitation of single-window span
//     and is the main reason a future per-monitor-window approach
//     would be more correct (see TODO below).
//   - TODO(per-monitor-windows): for a more robust multi-monitor
//     experience we could create one transparent overlay
//     BrowserWindow per display, each with its own renderer, and
//     synchronize board state across them via IPC. That is
//     substantially more complex (cross-window selection, click-
//     through coordination, toolbar placement, drag-across-windows)
//     and is out of scope for this iteration.
let displayMode = 'current' // 'current' | 'all'

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

// Compute the BrowserWindow rect for the requested overlay display mode.
//
// 'current' → screen.getDisplayMatching(win.getBounds()).bounds. This is
//             the display whose intersection with the window rect is
//             largest; we use full bounds (not workArea) so the overlay
//             covers the taskbar / dock too. Existing behavior.
//
// 'all'     → the bounding rectangle of every connected display. With
//             negative-coordinate displays (e.g. a monitor positioned
//             to the left of primary at x = -1920) the min/max math
//             below handles them correctly because Electron's screen
//             API uses logical (DIP) coordinates throughout. Returns
//             null only if no displays are connected (effectively
//             impossible during normal operation but handled
//             defensively so callers can fall back gracefully).
function computeOverlayBounds(win, mode) {
  if (mode === 'all') {
    const displays = screen.getAllDisplays()
    if (!displays || displays.length === 0) return null
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const d of displays) {
      const b = d.bounds
      if (b.x < minX) minX = b.x
      if (b.y < minY) minY = b.y
      if (b.x + b.width > maxX) maxX = b.x + b.width
      if (b.y + b.height > maxY) maxY = b.y + b.height
    }
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
  }
  // 'current' (default / fallback)
  return screen.getDisplayMatching(win.getBounds()).bounds
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
  // Compute the target overlay rect from the current displayMode mirror
  // (set by the renderer on launch and on every Toolbar toggle via the
  // `desktop:set-display-mode` IPC).
  const bounds = computeOverlayBounds(win, displayMode)
  if (!bounds) return false
  if (prevMaximized) win.unmaximize()
  // Set the flag BEFORE setBounds so the resize/move events that
  // immediately follow are correctly ignored by persistGeometry.
  inOverlayDisplay = true
  win.setBounds(bounds)
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

// Re-apply overlay bounds when something changes WHILE we're already in
// overlay mode — the user toggling display mode (current ↔ all) or a
// monitor being plugged in / removed in 'all' mode. We never enter or
// exit overlay here; we just resize to match the new requested rect.
// `inOverlayDisplay` stays true throughout so persistGeometry keeps
// ignoring the resulting move/resize events and the saved normal
// geometry is not overwritten.
function reapplyOverlayBounds(win) {
  if (!win || win.isDestroyed()) return
  if (!inOverlayDisplay) return
  const bounds = computeOverlayBounds(win, displayMode)
  if (!bounds) return
  win.setBounds(bounds)
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

// Display mode is driven by the renderer (localStorage source of truth).
// This handler is just a mirror update so enterOverlayDisplay /
// reapplyOverlayBounds can read the current mode synchronously, plus
// an immediate retarget if we're already in overlay mode (so the user
// sees the change without having to toggle Desktop Mode off and back on).
//
// The mode value is validated defensively — anything not exactly 'all'
// falls back to 'current'. We never trust IPC payload shape blindly
// even though the renderer is our own code; defense-in-depth keeps the
// surface narrow if a future preload regression smuggled a bad value.
ipcMain.handle('desktop:set-display-mode', (event, mode) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  const next = mode === 'all' ? 'all' : 'current'
  displayMode = next
  if (win) reapplyOverlayBounds(win)
  return displayMode
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
  // Once the user explicitly surfaces the window, the "start hidden"
  // intent has been satisfied — clear the guard so subsequent macOS
  // activate events / future show requests behave normally instead of
  // continuing to silently no-op.
  startupHideActive = false
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
  // Capability for the launch-on-startup item — disabled on Linux and
  // in dev with an explanatory label suffix so the user understands
  // *why* the toggle is greyed out instead of silently ignoring their
  // click. The persisted setting is preserved either way; if a future
  // build adds Linux autostart support the existing toggle reactivates.
  const launchSupported = isLaunchOnStartupSupported()
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
      label: 'Startup',
      submenu: [
        {
          label: launchSupported
            ? 'Launch on startup'
            : 'Launch on startup (unsupported on this platform)',
          type: 'checkbox',
          checked: !!startupSettings.launchOnStartup,
          enabled: launchSupported,
          click: (menuItem) => {
            // Use the menuItem.checked Electron sets *before* invoking
            // click, so a fast double-toggle stays consistent with the
            // user's intent rather than racing against startupSettings.
            applyStartupPatch({ launchOnStartup: !!menuItem.checked })
          },
        },
        {
          label: 'Start minimized to tray',
          type: 'checkbox',
          checked: !!startupSettings.startMinimized,
          enabled: true,
          click: (menuItem) => {
            applyStartupPatch({ startMinimized: !!menuItem.checked })
          },
        },
        {
          label: 'Start in Desktop Mode',
          type: 'checkbox',
          checked: !!startupSettings.startInDesktopMode,
          enabled: true,
          click: (menuItem) => {
            applyStartupPatch({ startInDesktopMode: !!menuItem.checked })
          },
        },
      ],
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

// Multi-monitor hotplug: when displays are added, removed, or have their
// metrics changed (resolution, position, scale), the union rect for
// 'all' mode changes too. Reapply so the overlay tracks the new
// virtual desktop. In 'current' mode we leave the overlay alone — if
// the active display was the one removed Electron will reposition the
// window automatically; the user can re-enter Desktop Mode from the
// new display if needed. The handler is registered once on app.whenReady
// (NOT inside createWindow) so it survives macOS dock-reactivation.
function onDisplayLayoutChanged() {
  if (!mainWindow || mainWindow.isDestroyed()) return
  if (!inOverlayDisplay) return
  if (displayMode !== 'all') return
  reapplyOverlayBounds(mainWindow)
}

app.whenReady().then(() => {
  // Load startup settings BEFORE createWindow so its ready-to-show
  // hook can act on startInDesktopMode / startMinimized. Also sync
  // the OS-level login-item state to match our persisted preference
  // — handles the case where the user toggled the OS autostart off
  // externally while our file still says on (or vice-versa). The
  // call is a no-op on platforms / build modes where it's unsupported.
  startupSettings = loadStartupSettings()
  applyLoginItemSettings(startupSettings.launchOnStartup)

  // Pre-emptively set the start-hidden guard before any window /
  // tray creation, so the macOS `activate` event — which can fire
  // BEFORE ready-to-show on initial launch — cannot defeat the
  // user's start-minimized intent by surfacing the window through
  // the activate handler's showMainWindow() call. The guard is
  // gated on the persisted intent only at this point because tray
  // creation hasn't happened yet; if tray creation later fails,
  // ready-to-show clears the guard and shows the window so the
  // user is never stranded with an invisible app and no tray icon.
  startupHideActive = !!startupSettings.startMinimized

  createWindow()
  screen.on('display-added', onDisplayLayoutChanged)
  screen.on('display-removed', onDisplayLayoutChanged)
  screen.on('display-metrics-changed', onDisplayLayoutChanged)
  // Tray creation is best-effort. createTray() returns null if the
  // icon file is missing/empty (so we don't create an invisible tray
  // that would strand the user); the constructor can also throw on
  // platforms without a status-area concept (some headless Linux
  // environments). In either case `tray` stays null and the close
  // handler gracefully falls back to default close (= quit) behavior,
  // guaranteeing the user always has a way to exit. When tray is
  // null, the start-minimized startup option also falls back to
  // showing the window (see ready-to-show) — the user can never end
  // up with both invisible window AND no tray icon.
  try {
    tray = createTray()
  } catch (err) {
    console.warn('MuralDesk: could not create system tray.', err)
    tray = null
  }
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
      return
    }
    // macOS fires `activate` on initial launch (not just on dock-click
    // reopens). Without this guard, a start-minimized launch would be
    // immediately defeated by activate calling showMainWindow(). The
    // flag is set in ready-to-show when start-minimized takes effect
    // and cleared on any explicit user-initiated show, so once the
    // user surfaces the window via the tray, subsequent activates
    // behave normally.
    if (startupHideActive) return
    showMainWindow()
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
