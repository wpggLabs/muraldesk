export default function EmptyState({ onSampleBoard, onAddNote }) {
  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      pointerEvents: 'none',
      userSelect: 'none',
    }}>
      <div style={{
        fontSize: 64,
        marginBottom: 18,
        opacity: 0.25,
      }}>
        🖼
      </div>
      <h1 style={{
        color: 'var(--text)',
        fontSize: 26,
        fontWeight: 700,
        marginBottom: 10,
        letterSpacing: -0.3,
        opacity: 0.9,
      }}>
        Your visual desk awaits
      </h1>
      <p style={{
        color: 'var(--text-muted)',
        fontSize: 14,
        lineHeight: 1.6,
        textAlign: 'center',
        maxWidth: 460,
        marginBottom: 22,
      }}>
        MuralDesk is a desktop pinboard for images, looping videos, links, and notes.
        Pin anything, drag it anywhere, and resize it to fit. Everything stays on your
        machine — no account, no cloud.
      </p>
      <div style={{
        display: 'flex',
        gap: 10,
        flexWrap: 'wrap',
        justifyContent: 'center',
        pointerEvents: 'auto',
      }}>
        <button
          onClick={onSampleBoard}
          style={primaryBtn}
        >
          ✨ Try a sample board
        </button>
        <button
          onClick={onAddNote}
          style={secondaryBtn}
        >
          📝 Add a note
        </button>
      </div>
      <div style={{
        marginTop: 28,
        color: 'var(--text-muted)',
        fontSize: 12,
        opacity: 0.6,
        textAlign: 'center',
        lineHeight: 1.7,
      }}>
        Tip: use the toolbar above to add an image, video, or link.<br />
        Press <Kbd>Delete</Kbd> to remove the selected card · <Kbd>Esc</Kbd> to deselect.
      </div>
    </div>
  )
}

function Kbd({ children }) {
  return (
    <span style={{
      display: 'inline-block',
      padding: '1px 6px',
      margin: '0 2px',
      border: '1px solid var(--border)',
      borderRadius: 4,
      background: 'var(--surface2)',
      color: 'var(--text)',
      fontSize: 11,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    }}>
      {children}
    </span>
  )
}

const primaryBtn = {
  background: 'var(--accent)',
  color: '#fff',
  border: 'none',
  borderRadius: 9,
  padding: '10px 18px',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  boxShadow: '0 4px 16px rgba(108,99,255,0.35)',
}

const secondaryBtn = {
  background: 'var(--surface2)',
  color: 'var(--text)',
  border: '1px solid var(--border)',
  borderRadius: 9,
  padding: '10px 18px',
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
}
