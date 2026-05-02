import { useEffect, useRef, useState } from 'react'

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

export default function Toolbar({
  onAddImage,
  onAddVideo,
  onAddNote,
  onAddLink,
  onClear,
  onSampleBoard,
  onExport,
  onImport,
  isFullscreen,
  onToggleFullscreen,
  isElectron = false,
  desktopMode = false,
  onToggleDesktopMode,
  hasItems = false,
  anyItemHovered = false,
  onMinimizeWindow,
  onCloseWindow,
}) {
  const imageInputRef = useRef(null)
  const videoInputRef = useRef(null)
  const importInputRef = useRef(null)
  const [linkDialog, setLinkDialog] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [linkTitle, setLinkTitle] = useState('')
  const [linkDesc, setLinkDesc] = useState('')

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
  const [nearTop, setNearTop] = useState(true)
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
  // entry point to add their first item.
  const forceShow = isElectron && !hasItems

  // Composite "should the toolbar be visible right now" signal.
  // anyItemHovered only counts in Electron mode — on the web build
  // the toolbar is always present so we don't need this to re-show it.
  const shouldShow = forceShow
    || nearTop
    || hovered
    || linkDialog
    || (isElectron && anyItemHovered)

  // Debounced visibility. `revealed` is the actual rendered state.
  // The 700 ms hide-grace only applies in modes where the toolbar
  // FULLY hides (Electron transparent-overlay + Desktop Canvas
  // immersive mode); on the web build the toolbar only dims (it stays
  // present), so no debounce is needed and we mirror `shouldShow`
  // synchronously to preserve the original web UX (instant dim).
  const debounceHide = isElectron || desktopMode
  const [revealed, setRevealed] = useState(true)
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
  // Both desktopMode and Electron-overlay mode fully hide the toolbar
  // when not visible (instead of just dimming it). On the web build it
  // stays present-but-dim, matching the original behavior.
  const fullyHidden = (desktopMode || isElectron) && !visible

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

  return (
    <>
      <div
        data-muraldesk-interactive="true"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          position: 'fixed',
          top: 14,
          left: '50%',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          background: 'rgba(20,20,26,0.78)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 999,
          padding: '5px 8px',
          boxShadow: '0 10px 32px rgba(0,0,0,0.5)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          maxWidth: 'calc(100vw - 32px)',
          flexWrap: 'wrap',
          justifyContent: 'center',
          opacity: fullyHidden ? 0 : (dim ? 0.32 : 1),
          pointerEvents: fullyHidden ? 'none' : 'auto',
          transform: fullyHidden ? 'translateX(-50%) translateY(-12px)' : 'translateX(-50%)',
          transition: 'opacity 0.25s ease, transform 0.25s ease',
          // In Electron the OS frame is gone, so the toolbar pill doubles
          // as the window's drag handle. Buttons inside opt out of the
          // drag region with WebkitAppRegion: 'no-drag' (see PillBtn).
          // No-op on the web build (the property is ignored by browsers).
          WebkitAppRegion: isElectron ? 'drag' : undefined,
        }}
      >
        <span
          style={{
            color: 'var(--accent)',
            fontWeight: 700,
            fontSize: 12,
            padding: '0 8px',
            letterSpacing: 0.5,
          }}
        >
          MuralDesk
        </span>

        <PillBtn icon="🖼" label="Image" onClick={() => imageInputRef.current?.click()} />
        <PillBtn icon="🎬" label="Video" onClick={() => videoInputRef.current?.click()} />
        <PillBtn icon="📝" label="Note" onClick={onAddNote} />
        <PillBtn icon="🔗" label="Link" onClick={() => setLinkDialog(true)} />

        <Divider />

        <PillBtn icon="✨" label="Sample" onClick={onSampleBoard} />
        <PillBtn icon="↧" label="Export" onClick={onExport} />
        <PillBtn icon="↥" label="Import" onClick={() => importInputRef.current?.click()} />

        <Divider />

        <PillBtn
          icon={isFullscreen ? '⤡' : '⤢'}
          label={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          onClick={onToggleFullscreen}
        />

        {isElectron && (
          <PillBtn
            icon="🖥"
            label={desktopMode ? 'Exit Desktop' : 'Desktop'}
            onClick={onToggleDesktopMode}
            active={desktopMode}
          />
        )}

        <Divider />

        <PillBtn
          icon="🗑"
          label="Clear"
          onClick={() => { if (confirm('Clear all items from the board?')) onClear() }}
          danger
        />

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
        <input ref={importInputRef} type="file" accept="application/json,.json" style={{ display: 'none' }} onChange={handleImportFile} />
      </div>

      {linkDialog && (
        <div
          data-muraldesk-interactive="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={() => setLinkDialog(false)}
        >
          <form
            onSubmit={handleLinkSubmit}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: 24,
              width: 360,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              boxShadow: 'var(--shadow)',
            }}
          >
            <div style={{ fontWeight: 600, fontSize: 15 }}>Add Link Card</div>
            <input
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="URL (e.g. https://example.com)"
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
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setLinkDialog(false)} style={cancelBtnStyle}>
                Cancel
              </button>
              <button type="submit" style={submitBtnStyle}>
                Add Card
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}

function Divider() {
  return (
    <div
      aria-hidden
      style={{
        width: 1,
        height: 18,
        background: 'rgba(255,255,255,0.08)',
        margin: '0 4px',
      }}
    />
  )
}

function PillBtn({ icon, label, onClick, danger, active, compact }) {
  const [hov, setHov] = useState(false)
  const bg = active
    ? 'rgba(108,99,255,0.22)'
    : hov
      ? danger ? 'rgba(255,79,79,0.18)' : 'rgba(255,255,255,0.08)'
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
      title={label}
      aria-label={label}
      aria-pressed={active ? 'true' : undefined}
      style={{
        background: bg,
        color,
        border: 'none',
        borderRadius: 999,
        padding: compact ? '4px 8px' : '4px 10px',
        fontSize: 13,
        display: 'flex',
        alignItems: 'center',
        gap: compact ? 0 : 5,
        transition: 'all 0.12s',
        whiteSpace: 'nowrap',
        cursor: 'pointer',
        // Opt this clickable button OUT of the toolbar's window-drag
        // region. Without this, in the Electron frameless build the
        // OS would consume the click as a window-drag and the button
        // would never fire. No-op on the web build.
        WebkitAppRegion: 'no-drag',
      }}
    >
      <span style={{ fontSize: 13, lineHeight: 1 }}>{icon}</span>
      {!compact && <span style={{ fontSize: 12 }}>{label}</span>}
    </button>
  )
}

const inputStyle = {
  background: 'var(--surface2)',
  border: '1px solid var(--border)',
  borderRadius: 7,
  padding: '8px 10px',
  color: 'var(--text)',
  fontSize: 13,
  width: '100%',
}

const cancelBtnStyle = {
  background: 'var(--surface2)',
  color: 'var(--text-muted)',
  border: '1px solid var(--border)',
  borderRadius: 7,
  padding: '6px 16px',
  fontSize: 13,
  cursor: 'pointer',
}

const submitBtnStyle = {
  background: 'var(--accent)',
  color: '#fff',
  border: 'none',
  borderRadius: 7,
  padding: '6px 16px',
  fontSize: 13,
  cursor: 'pointer',
}
