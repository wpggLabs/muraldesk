import { useState, useRef, useEffect } from 'react'

const NOTE_COLORS = ['#2a2a3a', '#2d2a1a', '#1a2a2a', '#2a1a2d', '#1a2d1a']

// Pick a readable text color for a given note background. Notes with no
// `item.color` (the new theme-aware default) use the theme's
// --note-text-default token directly, so light mode gets dark text on
// the soft-yellow default and dark mode gets light text on the slate
// default. Notes with an explicit swatch (the 5 NOTE_COLORS or any
// legacy persisted hex) compute luminance from the hex so the text
// stays readable regardless of the active theme — this is the case
// the architect flagged: in light mode, the dark NOTE_COLORS swatches
// would otherwise inherit var(--text) (a near-black) on a near-black
// swatch and become invisible.
function noteTextColor(bg) {
  if (!bg) return 'var(--note-text-default)'
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(bg.trim())
  if (!m) return 'var(--note-text-default)'
  let hex = m[1]
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('')
  const n = parseInt(hex, 16)
  const r = (n >> 16) & 0xff
  const g = (n >> 8) & 0xff
  const b = n & 0xff
  // Rec. 601 luminance, normalized to 0..1. Threshold 0.55 is a touch
  // above 0.5 so very-mid swatches (e.g. an imported #888888) lean
  // toward dark text — matching what the eye expects on a "light-ish"
  // background.
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return lum > 0.55 ? '#1a1a22' : '#f0f0f5'
}

export default function NoteCard({ item, onUpdate, hovered }) {
  const textColor = noteTextColor(item.color)
  const [editing, setEditing] = useState(false)
  const rootRef = useRef(null)
  const textRef = useRef(null)
  const interactiveTokenRef = useRef(`note:${item.id}`)

  function forceElectronInteractive(active) {
    if (typeof window === 'undefined') return
    const token = interactiveTokenRef.current
    window.dispatchEvent(new CustomEvent('muraldesk:force-interactive', {
      detail: { active, token },
    }))
    if (!active) return
    try {
      window.muraldesk?.setIgnoreMouseEvents?.(false)
      window.muraldesk?.focusWindow?.()
    } catch {
      /* ignore Electron bridge failures */
    }
  }

  useEffect(() => {
    if (!editing) return
    forceElectronInteractive(true)
    if (textRef.current) textRef.current.focus()
    return () => forceElectronInteractive(false)
  }, [editing])

  useEffect(() => {
    return () => forceElectronInteractive(false)
  }, [])

  function stopEvent(e) {
    e.stopPropagation()
    forceElectronInteractive(true)
  }

  function beginEditing(e) {
    if (e) e.stopPropagation()
    forceElectronInteractive(true)
    setEditing(true)
  }

  function releaseIfIdle() {
    const root = rootRef.current
    if (editing) return
    if (root && root.contains(document.activeElement)) return
    forceElectronInteractive(false)
  }

  return (
    <div
      ref={rootRef}
      data-muraldesk-interactive="true"
      onMouseEnter={() => forceElectronInteractive(true)}
      onMouseMove={() => forceElectronInteractive(true)}
      onPointerDownCapture={() => forceElectronInteractive(true)}
      onMouseLeave={releaseIfIdle}
      style={{
        width: '100%',
        height: '100%',
        // Theme-aware default: notes added after theming shipped omit
        // the `color` field (see App.jsx handleAddNote) and pick up the
        // current theme's --note-bg-default. Notes with a persisted
        // explicit color keep their swatch choice across theme changes.
        background: item.color || 'var(--note-bg-default)',
        // Top padding leaves room for the floating mini-toolbar without
        // covering note text.
        padding: '34px 14px 14px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Color swatches — only on hover/select. Marked no-drag so the
          color picker never starts an item drag. zIndex above the corner
          resize handle (z:25) so swatches always win clicks at the top-left. */}
      <div
        className="no-drag"
        data-muraldesk-interactive="true"
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          display: 'flex',
          gap: 4,
          position: 'absolute',
          top: 10,
          left: 10,
          zIndex: 30,
          opacity: hovered ? 1 : 0,
          pointerEvents: hovered ? 'auto' : 'none',
          transition: 'opacity 0.15s',
        }}
      >
        {NOTE_COLORS.map((c) => (
          <div
            key={c}
            data-muraldesk-interactive="true"
            onClick={() => onUpdate(item.id, { color: c })}
            title="Note color"
            style={{
              width: 11,
              height: 11,
              borderRadius: '50%',
              background: c,
              border: item.color === c ? '1.5px solid #fff' : '1.5px solid rgba(255,255,255,0.25)',
              cursor: 'pointer',
            }}
          />
        ))}
      </div>

      <textarea
        ref={textRef}
        className="no-drag"
        data-muraldesk-interactive="true"
        value={item.text || ''}
        onChange={(e) => onUpdate(item.id, { text: e.target.value })}
        onFocus={(e) => {
          stopEvent(e)
          setEditing(true)
        }}
        onMouseDown={beginEditing}
        onClick={stopEvent}
        onKeyDown={stopEvent}
        onBlur={(e) => {
          if (rootRef.current?.contains(e.relatedTarget)) return
          setEditing(false)
        }}
        style={{
          flex: 1,
          background: 'transparent',
          border: 'none',
          // Per-note readable text color — see noteTextColor above.
          // For default-color notes this resolves to the theme's
          // --note-text-default token (light/dark per theme); for
          // explicit swatches we compute from luminance so dark
          // swatches always get light text and vice versa.
          color: textColor,
          fontSize: 14,
          lineHeight: 1.5,
          resize: 'none',
          width: '100%',
          opacity: item.text || editing ? 1 : 0.6,
          pointerEvents: 'auto',
          userSelect: 'text',
          cursor: 'text',
          outline: 'none',
        }}
        placeholder="Click to write note..."
      />
    </div>
  )
}
