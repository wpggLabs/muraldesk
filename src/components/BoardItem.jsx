import { useState } from 'react'
import { Rnd } from 'react-rnd'
import ImageCard from './ImageCard'
import VideoCard from './VideoCard'
import NoteCard from './NoteCard'
import LinkCard from './LinkCard'

export default function BoardItem({
  item,
  selected,
  onUpdate,
  onRemove,
  onFocus,
  onSelect,
  onDuplicate,
}) {
  const [hovered, setHovered] = useState(false)
  const locked = !!item.locked
  const showControls = hovered || selected

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

  const borderColor = selected
    ? 'var(--accent)'
    : hovered
      ? 'var(--accent-hover)'
      : 'var(--border)'
  const borderWidth = selected ? 2 : 1.5
  const boxShadow = selected
    ? '0 0 0 2px rgba(108,99,255,0.25), 0 8px 32px rgba(0,0,0,0.55)'
    : 'var(--shadow)'

  return (
    <Rnd
      position={{ x: item.x, y: item.y }}
      size={{ width: item.width, height: item.height }}
      onDragStop={handleDragStop}
      onResizeStop={handleResizeStop}
      onMouseDown={() => {
        onFocus(item.id)
        onSelect && onSelect(item.id)
      }}
      style={{ zIndex: item.zIndex }}
      minWidth={120}
      minHeight={80}
      bounds="parent"
      dragHandleClassName="drag-handle"
      disableDragging={locked}
      enableResizing={!locked}
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
          border: `${borderWidth}px solid ${borderColor}`,
          background: 'var(--surface)',
          boxShadow,
          transition: 'border-color 0.15s, box-shadow 0.15s',
        }}
      >
        <div
          className={locked ? '' : 'drag-handle'}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 28,
            cursor: locked ? 'default' : 'grab',
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 8px',
            background: showControls ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0)',
            transition: 'background 0.15s',
          }}
        >
          {showControls && (
            <>
              <span
                style={{
                  color: 'var(--text-muted)',
                  fontSize: 11,
                  letterSpacing: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {item.type.toUpperCase()}
                {locked && <span title="Locked" style={{ fontSize: 10 }}>🔒</span>}
              </span>
              <div style={{ display: 'flex', gap: 4 }}>
                <IconBtn
                  title={locked ? 'Unlock' : 'Lock'}
                  onClick={(e) => { e.stopPropagation(); onUpdate(item.id, { locked: !locked }) }}
                  bg={locked ? 'var(--accent)' : 'rgba(255,255,255,0.12)'}
                >
                  {locked ? '🔒' : '🔓'}
                </IconBtn>
                <IconBtn
                  title="Duplicate"
                  onClick={(e) => { e.stopPropagation(); onDuplicate && onDuplicate(item.id) }}
                  bg="rgba(255,255,255,0.12)"
                >
                  ⧉
                </IconBtn>
                <IconBtn
                  title="Delete"
                  onClick={(e) => { e.stopPropagation(); onRemove(item.id) }}
                  bg="var(--danger)"
                >
                  ✕
                </IconBtn>
              </div>
            </>
          )}
        </div>
        <div style={{ width: '100%', height: '100%' }}>
          {renderContent()}
        </div>
        {hovered && !locked && (
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

function IconBtn({ children, onClick, title, bg }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        background: bg,
        color: '#fff',
        border: 'none',
        borderRadius: 4,
        width: 22,
        height: 20,
        fontSize: 11,
        lineHeight: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  )
}
