import { useState, useRef, useEffect } from 'react'

const NOTE_COLORS = ['#2a2a3a', '#2d2a1a', '#1a2a2a', '#2a1a2d', '#1a2d1a']

export default function NoteCard({ item, onUpdate }) {
  const [editing, setEditing] = useState(false)
  const textRef = useRef(null)

  useEffect(() => {
    if (editing && textRef.current) {
      textRef.current.focus()
    }
  }, [editing])

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: item.color || '#2a2a3a',
        padding: '32px 12px 12px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', gap: 4, marginBottom: 6, position: 'absolute', top: 30, right: 8 }}>
        {NOTE_COLORS.map(c => (
          <div
            key={c}
            onClick={() => onUpdate(item.id, { color: c })}
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: c,
              border: item.color === c ? '1.5px solid #fff' : '1.5px solid #555',
              cursor: 'pointer',
            }}
          />
        ))}
      </div>
      {editing ? (
        <textarea
          ref={textRef}
          value={item.text || ''}
          onChange={e => onUpdate(item.id, { text: e.target.value })}
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
