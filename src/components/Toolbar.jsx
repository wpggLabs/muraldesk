import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { boardOpacityIcon } from '../hooks/useBoardView'

// Reveal-zone height (px from top of viewport). When the cursor is
// within this band the toolbar shows. The Electron transparent-overlay
// uses a generous 80px so the user can easily move toward the toolbar
// without it slipping away. The web/PWA build keeps the original 110px
// so it doesn't change behavior. Desktop-Canvas immersive mode keeps a
// tighter band so a stray mouse near the top of an OS-fullscreen window
// doesn't constantly flash the toolbar back on.
function pickRevealPx({ isElectron, desktopMode }) {
  if (desktopMode) return 24
  if (isElectron) return 80
  return 110
}

// How long the toolbar lingers after the cursor leaves all reveal
// triggers, before it actually hides. Prevents flicker when the cursor
// briefly exits and re-enters the reveal zone (e.g. crossing a
// pixel-perfect boundary on the way to a button) and gives a generous
// grace window for the user to move toward the toolbar.
const HIDE_DELAY_MS = 700

function Toolbar({
  onAddImage,
  onAddVideo,
  onAddNote,
  onAddLink,
  onClear,
  onSampleBoard,
  // Tidy: shelf-packs every item into a clean grid inside the
  // current viewport via x/y updates only. App owns the geometry
  // math; toolbar is just a dispatcher. Hidden when there are no
  // items so an empty board doesn't show a useless button.
  onTidy,
  onExport,
  onExportBackup,
  onImport,
  isFullscreen,
  onToggleFullscreen,
  isElectron = false,
  desktopMode = false,
  onToggleDesktopMode,
  // Display selection for Desktop Mode. 'current' covers the monitor
  // the window is on; 'all' spans every connected monitor. The button
  // is shown only in the Electron build; on web it's a no-op concept.
  // The toggle is always clickable — selecting while NOT in Desktop
  // Mode just persists the preference for the next overlay entry; if
  // already in Desktop Mode, main reapplies bounds immediately.
  displayMode = 'current',
  onToggleDisplayMode,
  hasItems = false,
  anyItemHovered = false,
  // Snap-to-grid toggle (default OFF, persisted by useSnap in its own
  // localStorage key — does not touch the board layout key). When true
  // the toolbar button is highlighted and BoardItem applies react-rnd's
  // dragGrid + resizeGrid props plus subtle on-drag alignment guides.
  snap = false,
  onToggleSnap,
  // Board-level opacity (1, 0.75, 0.5, 0.3). Cycle button advances to
  // the next step. Active when < 1. Persisted by useBoardView in its
  // own `muraldesk-view` localStorage key.
  boardOpacity = 1,
  onCycleBoardOpacity,
  // Focus mode — when true, the toolbar fully hides unless the cursor
  // is in the top reveal-zone, the toolbar itself is hovered, a dialog
  // is open, OR any pinned item is hovered. Persisted alongside
  // boardOpacity in `muraldesk-view`. The mode also forces the
  // hide-debounce path on the web build (the same 700 ms grace timer
  // the Electron build already uses) so reveal/hide doesn't flicker
  // when the cursor crosses the reveal boundary on the way to a button.
  focusMode = false,
  onToggleFocusMode,
  // Theme controls. mode is 'dark' | 'light' | 'system' and accent is
  // one of 4 named colors. The pills cycle through their respective
  // arrays. State + persistence is owned by useTheme; the toolbar is
  // purely a view + dispatcher so the cycle is observable from any
  // future keyboard shortcut without lifting state out of the hook.
  themeMode = 'dark',
  themeAccent = 'purple',
  onCycleThemeMode,
  onCycleThemeAccent,
  onMinimizeWindow,
  onCloseWindow,
  // Toolbar visibility override driven by App's Ctrl+Shift+T shortcut.
  //   null   → auto (existing reveal-zone / hover / dialog logic)
  //   'show' → pinned visible regardless of cursor position
  //   'hide' → pinned hidden even while hovering an item
  // Cycled by App.jsx; the toolbar itself never mutates this — App
  // owns the state so the cycle is observable from the keyboard
  // handler and so the override survives toolbar re-mounts.
  manualOverride = null,
  // Opens the keyboard-shortcuts help modal (rendered by App). The
  // toolbar is just a dispatcher — the modal's open state lives in
  // App so the `?` key shortcut and the pill can both toggle it.
  onOpenShortcuts,
}, ref) {
  const imageInputRef = useRef(null)
  const videoInputRef = useRef(null)
  const importInputRef = useRef(null)
  const [linkDialog, setLinkDialog] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [linkTitle, setLinkTitle] = useState('')
  const [linkDesc, setLinkDesc] = useState('')
  // "More" dropdown — only used when the toolbar is in compact mode
  // (Electron Desktop Mode). Closed by default. Click-outside closes
  // it via a global mousedown listener installed only while open.
  const [moreOpen, setMoreOpen] = useState(false)
  const moreBtnRef = useRef(null)
  const morePanelRef = useRef(null)
  // Compact toolbar = Electron Desktop Mode only. Web/PWA and normal-
  // window Electron keep the full pill row. Toggling this string drives
  // both (a) which pills render inline and (b) whether the More button
  // + popover render at all.
  const compact = desktopMode
  // Auto-close the More popover whenever we leave compact mode (e.g.
  // user clicks Exit Desktop), and install a global click-outside +
  // Escape listener while open. The popover itself stops propagation.
  useEffect(() => {
    if (!compact && moreOpen) setMoreOpen(false)
  }, [compact, moreOpen])
  useEffect(() => {
    if (!moreOpen) return
    function onDocMouseDown(e) {
      const inBtn = moreBtnRef.current && moreBtnRef.current.contains(e.target)
      const inPanel = morePanelRef.current && morePanelRef.current.contains(e.target)
      if (!inBtn && !inPanel) setMoreOpen(false)
    }
    function onKey(e) { if (e.key === 'Escape') setMoreOpen(false) }
    document.addEventListener('mousedown', onDocMouseDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [moreOpen])

  // Imperative handle: lets App.jsx open the file pickers and the link
  // dialog from keyboard shortcuts (Ctrl+Shift+I / V / L) without
  // having to lift Toolbar's internal refs and dialog state out of
  // this component. The link-dialog opener flips internal state, which
  // already triggers the auto-show path via `linkDialog` in
  // `autoShow`, so the toolbar reveals itself even if the user fired
  // the shortcut while it was hidden.
  useImperativeHandle(ref, () => ({
    openImagePicker: () => imageInputRef.current?.click(),
    openVideoPicker: () => videoInputRef.current?.click(),
    openLinkDialog: () => setLinkDialog(true),
  }), [])

  // Visibility behavior — three layered modes:
  //   1. Web build (default):
  //        Toolbar is always present, dims when the cursor drifts away
  //        from the top of the canvas. Hover or open dialog re-brightens.
  //   2. Desktop Canvas Mode (Electron, OS fullscreen):
  //        Tighter reveal band (24 px) so a stray mouse near the top of
  //        a fullscreen window doesn't constantly flash the toolbar
  //        back on. When not visible the toolbar fully hides
  //        (opacity 0 + pointer-events: none) and slides up.
  //   3. Electron transparent-overlay mode (always-on for the Electron
  //      build per the user's spec):
  //        - Empty board → keep toolbar visible so the user can add
  //          their first item.
  //        - Once items exist → hide unless the cursor is in the top
  //          80 px reveal zone, the toolbar is hovered, a dialog is
  //          open, OR any pinned item is hovered. Once any of those
  //          turn false, a 700 ms grace timer starts; if any of them
  //          becomes true again before it expires, the timer is
  //          cancelled. Prevents flicker / "slipping away" toolbar.
  // When MuralDesk launches in a "fully-hidden" mode (Electron
  // transparent-overlay or Desktop Canvas) WITH items already on the
  // board, the toolbar should be hidden until the user explicitly
  // moves the cursor into the top reveal zone or hovers an item —
  // the app should not "stay visible just because the app is
  // focused" on launch. Defaulting `nearTop` to true (the previous
  // behavior) caused a visible toolbar flash on launch. The empty-
  // board case still force-shows via `forceShow` below so first-run
  // users have a discoverable entry point.
  // Focus mode also starts hidden: the user explicitly opted into
  // hiding the toolbar, so respect that on first paint after a refresh
  // (otherwise there'd be a visible toolbar flash before the first
  // mousemove proves the cursor isn't in the reveal zone).
  const startsHidden = ((isElectron || desktopMode) && hasItems) || focusMode
  const [nearTop, setNearTop] = useState(!startsHidden)
  const [hovered, setHovered] = useState(false)
  useEffect(() => {
    const REVEAL_PX = pickRevealPx({ isElectron, desktopMode })
    function onMove(e) {
      setNearTop(e.clientY < REVEAL_PX)
    }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [desktopMode, isElectron])

  // Empty board in Electron → force-show so the user has a visible
  // entry point to add their first item. Focus mode disables this:
  // the user explicitly chose to hide the toolbar, and they can
  // always reveal it via top-hover.
  const forceShow = isElectron && !hasItems && !focusMode

  // Composite "should the toolbar be visible right now" signal.
  //   - Default mode: anyItemHovered only counts in Electron (the web
  //     build's toolbar is always present and merely dims, so it
  //     doesn't need item-hover to re-show).
  //   - Focus mode: item-hover counts in BOTH builds — that's the
  //     entire point of the mode (hide unless top-hover OR item-hover).
  const autoShow = forceShow
    || nearTop
    || hovered
    || linkDialog
    || ((isElectron || focusMode) && anyItemHovered)
  // Manual override (Ctrl+Shift+T) beats auto behavior. 'show' pins
  // the toolbar visible regardless of cursor position; 'hide' pins
  // it hidden even while hovering an item; null defers to auto. The
  // 'show' branch still allows linkDialog to keep it visible (since
  // both resolve to true), so opening the Add-Link dialog while in
  // 'hide' mode would still hide the toolbar pill — but the dialog
  // itself is its own fixed-position layer so the user can still
  // interact with it.
  const shouldShow = manualOverride === 'show'
    ? true
    : manualOverride === 'hide'
      ? false
      : autoShow

  // Debounced visibility. `revealed` is the actual rendered state.
  // The 700 ms hide-grace applies in any mode where the toolbar
  // FULLY hides (Electron transparent-overlay, Desktop Canvas
  // immersive mode, OR Focus Mode on web) — without the grace the
  // user would see the toolbar disappear mid-cursor-travel as they
  // move from the reveal zone toward a button. Plain web (no focus
  // mode) keeps the original instant-dim UX.
  const debounceHide = isElectron || desktopMode || focusMode
  // Same start-hidden rule as nearTop above: launch hidden when items
  // already exist in a fully-hidden mode, otherwise launch revealed
  // (web build, empty board, normal Electron with no items, …).
  const [revealed, setRevealed] = useState(!startsHidden)
  const hideTimerRef = useRef(null)
  useEffect(() => {
    if (!debounceHide) {
      // Web build: no debouncing. Cancel any stale timer (in case the
      // user toggled modes) and mirror shouldShow directly.
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current)
        hideTimerRef.current = null
      }
      setRevealed(shouldShow)
      return
    }
    // Electron / Desktop Canvas: show is immediate, hide is debounced.
    if (shouldShow) {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current)
        hideTimerRef.current = null
      }
      setRevealed(true)
      return
    }
    if (hideTimerRef.current) return // a hide is already pending
    hideTimerRef.current = setTimeout(() => {
      hideTimerRef.current = null
      setRevealed(false)
    }, HIDE_DELAY_MS)
  }, [shouldShow, debounceHide])
  useEffect(() => () => {
    // On unmount, clear any pending hide timer so we don't call
    // setState on an unmounted component.
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current)
      hideTimerRef.current = null
    }
  }, [])

  const visible = revealed
  const dim = !visible
  // Desktop Canvas, Electron overlay, AND Focus Mode all fully hide
  // the toolbar when not visible (opacity 0 + pointer-events: none +
  // slide up). Plain web without focus mode keeps the original
  // present-but-dim behavior — the toolbar is always there, just at
  // 36% opacity when the cursor isn't near the top.
  const fullyHidden = (desktopMode || isElectron || focusMode) && !visible

  function handleImageFile(e) {
    const file = e.target.files[0]
    if (!file) return
    onAddImage(file)
    e.target.value = ''
  }

  function handleVideoFile(e) {
    const file = e.target.files[0]
    if (!file) return
    onAddVideo(file)
    e.target.value = ''
  }

  function handleImportFile(e) {
    const file = e.target.files[0]
    if (!file) return
    onImport && onImport(file)
    e.target.value = ''
  }

  function handleLinkSubmit(e) {
    e.preventDefault()
    let url = linkUrl.trim()
    if (!url) return
    // Reject explicit non-http(s) schemes outright (javascript:, data:, file:,
    // mailto:, etc) so unsafe URLs never even enter the board state.
    const schemeMatch = url.match(/^([a-z][a-z0-9+.-]*):/i)
    if (schemeMatch) {
      const scheme = schemeMatch[1].toLowerCase()
      if (scheme !== 'http' && scheme !== 'https') {
        alert('Only http and https URLs are allowed.')
        return
      }
    } else {
      url = 'https://' + url
    }
    try {
      const parsed = new URL(url)
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        alert('Only http and https URLs are allowed.')
        return
      }
    } catch {
      alert('That does not look like a valid URL.')
      return
    }
    onAddLink(url, linkTitle.trim(), linkDesc.trim())
    setLinkUrl('')
    setLinkTitle('')
    setLinkDesc('')
    setLinkDialog(false)
  }

  // Advanced cluster — every pill that's NOT one of the always-visible
  // essentials (Image · Video · Note · Link · Sample · Desktop · Min ·
  // Close). Rendered inline in the toolbar pill when !compact, or
  // inside the More popover when compact. Single source of truth so
  // behavior is identical between the two layouts.
  function renderAdvancedPills() {
    return (
      <>
        {hasItems && (
          <PillBtn
            icon="▦"
            label="Tidy"
            onClick={() => onTidy && onTidy()}
            title="Arrange all items into a clean grid"
          />
        )}
        <PillBtn icon="↧" label="Export" onClick={onExport} title="Export layout JSON (this machine only — media stays in this browser)" />
        <PillBtn icon="📦" label="Backup" onClick={onExportBackup} title="Export portable backup (.muraldesk.json) — includes media for cross-machine restore" />
        <PillBtn icon="↥" label="Import" onClick={() => importInputRef.current?.click()} title="Import a layout or backup file (auto-detected)" />

        <Divider />

        {isElectron && (
          <PillBtn
            icon={displayMode === 'all' ? '▦' : '▢'}
            label={displayMode === 'all' ? 'All Displays' : '1 Display'}
            onClick={onToggleDisplayMode}
            active={displayMode === 'all'}
          />
        )}
        <PillBtn
          icon="🧲"
          label={snap ? 'Snap On' : 'Snap Off'}
          onClick={onToggleSnap}
          active={snap}
          title={snap
            ? 'Snap is ON — drag/resize snaps to a 24 px grid. Click to turn off.'
            : 'Snap is OFF — drag/resize freely. Click to turn on.'}
        />
        <PillBtn
          icon={boardOpacityIcon(boardOpacity)}
          label={boardOpacity >= 0.999
            ? 'Board'
            : `Board ${Math.round(boardOpacity * 100)}%`}
          onClick={onCycleBoardOpacity}
          active={boardOpacity < 0.999}
          title={`Board opacity ${Math.round(boardOpacity * 100)}% — click to cycle (100 / 75 / 50 / 30)`}
        />
        <PillBtn
          icon="👁"
          label={focusMode ? 'Focus On' : 'Focus'}
          onClick={onToggleFocusMode}
          active={focusMode}
          title={focusMode
            ? 'Focus mode is ON — toolbar hides unless you hover the top of the screen or an item. Click to turn off.'
            : 'Focus mode is OFF — toolbar stays visible. Click to enter focus mode (hover top or any item to reveal).'}
        />

        <Divider />

        <PillBtn
          icon={themeMode === 'light' ? '☀' : themeMode === 'system' ? '◑' : '☾'}
          label={themeMode === 'light' ? 'Light' : themeMode === 'system' ? 'System' : 'Dark'}
          onClick={onCycleThemeMode}
          title={`Theme: ${themeMode} — click to cycle (Dark → Light → System)`}
        />
        <PillBtn
          icon="●"
          iconColor="var(--accent)"
          label={themeAccent.charAt(0).toUpperCase() + themeAccent.slice(1)}
          onClick={onCycleThemeAccent}
          title={`Accent: ${themeAccent} — click to cycle (Purple → Blue → Green → Orange)`}
        />

        <Divider />

        <PillBtn
          icon="⌨"
          label="Shortcuts"
          compact
          title="Keyboard shortcuts (?)"
          onClick={() => onOpenShortcuts && onOpenShortcuts()}
        />

        <PillBtn
          icon="🗑"
          label="Clear"
          onClick={() => { if (confirm('Clear all items from the board?')) onClear() }}
          danger
        />
      </>
    )
  }

  return (
    <>
      {/*
        Hover "safe zone" wrapper. The visible pill is INSIDE this
        container, but the container extends 14px beyond the pill on
        every side via padding. Because onMouseEnter/onMouseLeave are
        attached HERE (not on the pill), a cursor moving toward the
        toolbar from below or the side keeps the hover state alive
        before it actually crosses the pill border — the toolbar can
        never "slip away" from a user moving toward it. The padding is
        transparent so visually nothing changes.

        The wrapper itself is pointer-events: none when fully hidden so
        clicks pass straight through to the canvas / desktop in
        Electron transparent-overlay mode.
      */}
      <div
        data-muraldesk-interactive="true"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          position: 'fixed',
          top: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999,
          padding: '14px 14px 18px',
          pointerEvents: fullyHidden ? 'none' : 'auto',
        }}
      >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          background: 'var(--surface-glass-strong)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-pill)',
          padding: '5px 7px',
          boxShadow:
            '0 12px 40px rgba(0,0,0,0.55), 0 1px 0 rgba(255,255,255,0.04) inset',
          backdropFilter: 'blur(18px) saturate(180%)',
          WebkitBackdropFilter: 'blur(18px) saturate(180%)',
          maxWidth: 'calc(100vw - 32px)',
          flexWrap: 'wrap',
          justifyContent: 'center',
          opacity: fullyHidden ? 0 : (dim ? 0.36 : 1),
          transform: fullyHidden ? 'translateY(-14px)' : 'translateY(0)',
          transition: 'opacity var(--t-med) var(--ease-out), transform var(--t-med) var(--ease-out)',
          // In Electron the OS frame is gone, so the toolbar pill doubles
          // as the window's drag handle. Buttons inside opt out of the
          // drag region with WebkitAppRegion: 'no-drag' (see PillBtn).
          // No-op on the web build (the property is ignored by browsers).
          WebkitAppRegion: isElectron ? 'drag' : undefined,
        }}
      >
        <span
          style={{
            color: 'var(--text)',
            fontWeight: 600,
            fontSize: 12,
            padding: '0 10px 0 8px',
            letterSpacing: -0.1,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span
            aria-hidden
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'var(--accent)',
              boxShadow: '0 0 8px rgba(var(--accent-rgb), 0.7)',
            }}
          />
          MuralDesk
        </span>

        <PillBtn icon="🖼" label="Image" onClick={() => imageInputRef.current?.click()} />
        <PillBtn icon="🎬" label="Video" onClick={() => videoInputRef.current?.click()} />
        <PillBtn icon="📝" label="Note" onClick={onAddNote} />
        <PillBtn icon="🔗" label="Link" onClick={() => setLinkDialog(true)} />

        <Divider />

        <PillBtn icon="✨" label="Sample" onClick={onSampleBoard} />

        {/* ---------------- Advanced cluster ---------------------------
            In compact mode (Electron Desktop Mode) every pill below
            moves into the More popover instead of rendering inline,
            keeping the always-visible toolbar to: MuralDesk · Image ·
            Video · Note · Link · Sample · More · Desktop · Min · Close.
            The popover renders the same JSX via renderAdvancedPills()
            so behavior is byte-identical to the inline form. */}
        {!compact && renderAdvancedPills()}

        {/* Compact-mode More button — opens the popover that contains
            every pill from the advanced cluster. Active styling while
            open so it reads as a toggle. */}
        {compact && (
          <span ref={moreBtnRef} style={{ display: 'inline-flex' }}>
            <PillBtn
              icon="⋯"
              label="More"
              onClick={() => setMoreOpen((v) => !v)}
              active={moreOpen}
              title="More board actions"
            />
          </span>
        )}

        {/*
          The Fullscreen button is web/PWA only. In Electron the Desktop
          Mode button below already drives the equivalent behavior (the
          BrowserWindow expands to cover the current display via
          setBounds(display.bounds) — see electron/main.cjs), so showing
          two redundant toggles makes the toolbar feel cluttered and
          "app-like". Web keeps the Fullscreen button so the
          Ctrl/Cmd+Shift+F shortcut and toolbar control still pair up.
          Hidden in compact mode (which is Electron-only anyway).
        */}
        {!isElectron && !compact && (
          <PillBtn
            icon={isFullscreen ? '⤡' : '⤢'}
            label={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            onClick={onToggleFullscreen}
          />
        )}

        {isElectron && (
          <PillBtn
            icon="🖥"
            label={desktopMode ? 'Exit Desktop' : 'Desktop'}
            onClick={onToggleDesktopMode}
            active={desktopMode}
          />
        )}

        {isElectron && (
          <>
            <Divider />
            <PillBtn
              icon="—"
              label="Minimize"
              compact
              onClick={() => onMinimizeWindow && onMinimizeWindow()}
            />
            <PillBtn
              icon="✕"
              label="Close"
              compact
              onClick={() => onCloseWindow && onCloseWindow()}
              danger
            />
          </>
        )}

        <input ref={imageInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageFile} />
        <input ref={videoInputRef} type="file" accept="video/*" style={{ display: 'none' }} onChange={handleVideoFile} />
        <input ref={importInputRef} type="file" accept="application/json,.json,.muraldesk.json" style={{ display: 'none' }} onChange={handleImportFile} />
      </div>

      {/* More popover — only rendered in compact mode (Electron Desktop
          Mode). Anchored just below the toolbar pill, centered on the
          viewport. data-muraldesk-interactive keeps Electron click-
          through treating it as fully interactive. The same pills
          render here as in renderAdvancedPills() above — single source
          of truth, so behavior is identical. */}
      {compact && moreOpen && (
        <div
          ref={morePanelRef}
          data-muraldesk-interactive="true"
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            marginTop: 6,
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 1,
            padding: '5px 7px',
            background: 'var(--surface-glass-strong)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-pill)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.55), 0 1px 0 rgba(255,255,255,0.04) inset',
            backdropFilter: 'blur(18px) saturate(180%)',
            WebkitBackdropFilter: 'blur(18px) saturate(180%)',
            maxWidth: 'min(92vw, 760px)',
            animation: 'muraldesk-overlay-in 160ms var(--ease-out) both',
            WebkitAppRegion: 'no-drag',
          }}
        >
          {renderAdvancedPills()}
        </div>
      )}
      </div>

      {linkDialog && (
        <div
          data-muraldesk-interactive="true"
          style={{
            position: 'fixed',
            inset: 0,
            // Above the toolbar pill (z:9999) so the dialog always
            // wins clicks even when the toolbar is force-shown.
            zIndex: 99999,
            background: 'rgba(0,0,0,0.55)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'muraldesk-overlay-in 200ms var(--ease-out) both',
          }}
          onClick={() => setLinkDialog(false)}
        >
          <form
            onSubmit={handleLinkSubmit}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border-strong)',
              borderRadius: 'var(--radius-lg)',
              padding: 22,
              width: 380,
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
              boxShadow: 'var(--shadow-lg)',
              animation: 'muraldesk-dialog-in 220ms var(--ease-out) both',
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: 15, letterSpacing: -0.1, marginBottom: 4 }}>
                Add a link
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                Paste a URL — YouTube, an image, a video, or any web page.
              </div>
            </div>
            <input
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://example.com"
              required
              autoFocus
              style={inputStyle}
            />
            <input
              value={linkTitle}
              onChange={(e) => setLinkTitle(e.target.value)}
              placeholder="Title (optional)"
              style={inputStyle}
            />
            <textarea
              value={linkDesc}
              onChange={(e) => setLinkDesc(e.target.value)}
              placeholder="Description (optional)"
              rows={2}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 2 }}>
              <button type="button" onClick={() => setLinkDialog(false)} style={cancelBtnStyle}>
                Cancel
              </button>
              <button type="submit" style={submitBtnStyle}>
                Add card
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}

// Wrap with forwardRef at export so App.jsx can attach a ref and call
// the imperative methods exposed via useImperativeHandle above. The
// inner function is named so React DevTools shows "Toolbar" instead of
// "ForwardRef(Toolbar)".
const ToolbarWithRef = forwardRef(Toolbar)
export default ToolbarWithRef

function Divider() {
  return (
    <div
      aria-hidden
      style={{
        width: 1,
        height: 18,
        background: 'var(--border)',
        margin: '0 5px',
      }}
    />
  )
}

function PillBtn({ icon, iconColor, label, onClick, danger, active, compact, title }) {
  const [hov, setHov] = useState(false)
  const bg = active
    ? 'var(--accent-soft)'
    : hov
      ? danger ? 'var(--danger-soft)' : 'var(--btn-hover)'
      : 'transparent'
  const color = danger
    ? hov ? 'var(--danger)' : 'var(--text-muted)'
    : active ? 'var(--accent)' : hov ? 'var(--text)' : 'var(--text-muted)'
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      title={title || label}
      aria-label={label}
      aria-pressed={active ? 'true' : undefined}
      style={{
        background: bg,
        color,
        border: 'none',
        borderRadius: 'var(--radius-pill)',
        padding: compact ? '5px 9px' : '5px 11px',
        fontSize: 12.5,
        fontWeight: 500,
        letterSpacing: 0.05,
        display: 'flex',
        alignItems: 'center',
        gap: compact ? 0 : 6,
        transition: 'background var(--t-fast) var(--ease-out), color var(--t-fast) var(--ease-out)',
        whiteSpace: 'nowrap',
        cursor: 'pointer',
        // Opt this clickable button OUT of the toolbar's window-drag
        // region. Without this, in the Electron frameless build the
        // OS would consume the click as a window-drag and the button
        // would never fire. No-op on the web build.
        WebkitAppRegion: 'no-drag',
      }}
    >
      <span style={{ fontSize: 13, lineHeight: 1, color: iconColor || undefined }}>{icon}</span>
      {!compact && <span>{label}</span>}
    </button>
  )
}

const inputStyle = {
  background: 'var(--surface2)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  padding: '9px 11px',
  color: 'var(--text)',
  fontSize: 13,
  width: '100%',
  transition: 'border-color var(--t-fast) var(--ease-out), background var(--t-fast) var(--ease-out)',
}

const cancelBtnStyle = {
  background: 'transparent',
  color: 'var(--text-muted)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  padding: '7px 16px',
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
  transition: 'background var(--t-fast) var(--ease-out), color var(--t-fast) var(--ease-out)',
}

const submitBtnStyle = {
  background: 'var(--accent)',
  color: '#fff',
  border: 'none',
  borderRadius: 'var(--radius-sm)',
  padding: '7px 16px',
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
  // Glow follows the active accent via the rgb-triplet token.
  boxShadow: '0 4px 14px rgba(var(--accent-rgb), 0.32), inset 0 1px 0 rgba(255,255,255,0.12)',
  transition: 'background var(--t-fast) var(--ease-out)',
}
