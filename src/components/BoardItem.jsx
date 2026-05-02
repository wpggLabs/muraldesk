import { useRef, useState } from 'react'
import { Rnd } from 'react-rnd'
import ImageCard from './ImageCard'
import VideoCard from './VideoCard'
import NoteCard from './NoteCard'
import LinkCard from './LinkCard'

export default function BoardItem({ item, onUpdate, onRemove, onFocus }) {
  const [hovered, setHovered] = useState(false)

  function handleDragStop(e, d) {
    onUpdate(item.id, { x: d.x, y: d.y })
  }

  function handleResizeStop(e, dir, ref, delta, pos) {
    onUpdate(item.id, {
      width: parseInt(ref.style.width),
      height: parseInt(ref.style.height),
      x: pos.x,
      y: pos.y,
    })
  }

  function renderContent() {
    switch (item.type) {
      case 'image': return <ImageCard item={item} />
      case 'video': return <VideoCard item={item} onUpdate={onUpdate} />
      case 'note': return <NoteCard item={item} onUpdate={onUpdate} />
      case 'link': return <LinkCard item={item} />
      default: return null
    }
  }

  return (
    <Rnd
      position={{ x: item.x, y: item.y }}
      size={{ width: item.width, height: item.height }}
      onDragStop={handleDragStop}
      onResizeStop={handleResizeStop}
      onMouseDown={() => onFocus(item.id)}
      style={{ zIndex: item.zIndex }}
      minWidth={120}
      minHeight={80}
      bounds="parent"
      dragHandleClassName="drag-handle"
      resizeHandleStyles={{
        bottomRight: { width: 18, height: 18, right: 0, bottom: 0 },
        bottomLeft: { width: 18, height: 18, left: 0, bottom: 0 },
        topRight: { width: 18, height: 18, right: 0, top: 0 },
        topLeft: { width: 18, height: 18, left: 0, top: 0 },
        right: { width: 8, right: -2 },
        left: { width: 8, left: -2 },
        top: { height: 8, top: -2 },
        bottom: { height: 8, bottom: -2 },
      }}
    >
      <div
        className="board-item"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          borderRadius: 'var(--radius)',
          overflow: 'hidden',
          border: hovered ? '1.5px solid var(--accent)' : '1.5px solid var(--border)',
          background: 'var(--surface)',
          boxShadow: 'var(--shadow)',
          transition: 'border-color 0.15s',
        }}
      >
        <div
          className="drag-handle"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 28,
            cursor: 'grab',
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 8px',
            background: hovered ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0)',
            transition: 'background 0.15s',
          }}
        >
          {hovered && (
            <>
              <span style={{ color: 'var(--text-muted)', fontSize: 11, letterSpacing: 1 }}>
                {item.type.toUpperCase()}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); onRemove(item.id) }}
                style={{
                  background: 'var(--danger)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 4,
                  width: 20,
                  height: 20,
                  fontSize: 12,
                  lineHeight: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                ✕
              </button>
            </>
          )}
        </div>
        <div style={{ width: '100%', height: '100%' }}>
          {renderContent()}
        </div>
        {hovered && (
          <div
            aria-hidden
            style={{
              position: 'absolute',
              right: 2,
              bottom: 2,
              width: 14,
              height: 14,
              pointerEvents: 'none',
              opacity: 0.7,
              color: 'var(--text-muted)',
              fontSize: 14,
              lineHeight: '14px',
              textAlign: 'right',
              userSelect: 'none',
            }}
          >
            ⌟
          </div>
        )}
      </div>
    </Rnd>
  )
}
