// Minimal empty-state hint. Lives only on the web/PWA build (App.jsx
// doesn't render it in Electron transparent-overlay mode). Designed to
// feel like an ambient wallpaper rather than a marketing page — small
// centered glyph, one short sentence, two restrained actions.
export default function EmptyState({ onSampleBoard, onAddNote }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        // The whole hint is non-interactive by default; the inner button
        // row re-enables pointer events. This keeps the canvas itself
        // fully clickable so a click on the empty area still deselects.
        pointerEvents: 'none',
        userSelect: 'none',
        animation: 'muraldesk-fade-in 420ms var(--ease-out) both',
      }}
    >
      <div
        aria-hidden
        style={{
          width: 56,
          height: 56,
          borderRadius: 14,
          background: 'linear-gradient(135deg, rgba(124,108,255,0.18), rgba(124,108,255,0.06))',
          border: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 24,
          marginBottom: 18,
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <span style={{ opacity: 0.85 }}>🖼</span>
      </div>

      <p
        style={{
          color: 'var(--text)',
          fontSize: 15,
          fontWeight: 500,
          letterSpacing: -0.1,
          marginBottom: 6,
          opacity: 0.92,
        }}
      >
        Drop images, videos, links, or notes anywhere
      </p>
      <p
        style={{
          color: 'var(--text-muted)',
          fontSize: 12.5,
          lineHeight: 1.55,
          textAlign: 'center',
          maxWidth: 360,
          marginBottom: 22,
        }}
      >
        Pin anything to your visual desk. Drag, resize, and arrange — everything stays on your machine.
      </p>

      <div
        style={{
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          justifyContent: 'center',
          pointerEvents: 'auto',
        }}
      >
        <button
          type="button"
          onClick={onSampleBoard}
          style={primaryBtn}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--accent-hover)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'var(--accent)'}
        >
          Try a sample board
        </button>
        <button
          type="button"
          onClick={onAddNote}
          style={secondaryBtn}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--surface2)'
            e.currentTarget.style.borderColor = 'var(--border-strong)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.borderColor = 'var(--border)'
          }}
        >
          Add a note
        </button>
      </div>

      <div
        style={{
          marginTop: 26,
          color: 'var(--text-dim)',
          fontSize: 11,
          letterSpacing: 0.2,
          textAlign: 'center',
          lineHeight: 1.7,
        }}
      >
        <Kbd>Delete</Kbd> remove selected · <Kbd>Esc</Kbd> deselect
      </div>
    </div>
  )
}

function Kbd({ children }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '1px 6px',
        margin: '0 3px',
        border: '1px solid var(--border)',
        borderRadius: 4,
        background: 'rgba(255,255,255,0.03)',
        color: 'var(--text-muted)',
        fontSize: 10.5,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      }}
    >
      {children}
    </span>
  )
}

const primaryBtn = {
  background: 'var(--accent)',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  padding: '8px 16px',
  fontSize: 12.5,
  fontWeight: 500,
  cursor: 'pointer',
  letterSpacing: 0.1,
  boxShadow: '0 4px 14px rgba(124,108,255,0.32), inset 0 1px 0 rgba(255,255,255,0.12)',
  transition: 'background var(--t-fast) var(--ease-out)',
}

const secondaryBtn = {
  background: 'transparent',
  color: 'var(--text-muted)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '8px 16px',
  fontSize: 12.5,
  fontWeight: 500,
  cursor: 'pointer',
  letterSpacing: 0.1,
  transition: 'background var(--t-fast) var(--ease-out), border-color var(--t-fast) var(--ease-out)',
}
