import { useState, useRef, useEffect } from 'react'

const NOTE_COLORS = ['#2a2a3a', '#2d2a1a', '#1a2a2a', '#2a1a2d', '#1a2d1a']

export default function NoteCard({ item, onUpdate, hovered }) {
  const [editing, setEditing] = useState(false)
  const textRef = useRef(null)

  useEffect(() => {
    if (editing && textRef.current) textRef.current.focus()
  }, [editing])

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: item.color || '#2a2a3a',
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

      {editing ? (
        <textarea
          ref={textRef}
          className="no-drag"
          value={item.text || ''}
          onChange={(e) => onUpdate(item.id, { text: e.target.value })}
          onBlur={() => setEditing(false)}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            color: 'var(--text)',
            fontSize: 14,
            lineHeight: 1.5,
            resize: 'none',
            width: '100%',
          }}
          placeholder="Write a note..."
        />
      ) : (
        <div
          onDoubleClick={() => setEditing(true)}
          style={{
            flex: 1,
            color: item.text ? 'var(--text)' : 'var(--text-muted)',
            fontSize: 14,
            lineHeight: 1.5,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            cursor: 'text',
            overflow: 'auto',
          }}
        >
          {item.text || 'Double-click to edit note...'}
        </div>
      )}
    </div>
  )
}
