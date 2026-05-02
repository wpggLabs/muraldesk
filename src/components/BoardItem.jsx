import { useState } from 'react'
import { Rnd } from 'react-rnd'
import ImageCard from './ImageCard'
import VideoCard from './VideoCard'
import NoteCard from './NoteCard'
import LinkCard from './LinkCard'

// Selectors that should never start a drag (text editing, video controls,
// link buttons, the floating mini-toolbar). Forwarded to react-draggable
// via react-rnd's `cancel` prop.
const DRAG_CANCEL = '.no-drag, textarea, input, button, a, video'

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
      case 'video': return <VideoCard item={item} onUpdate={onUpdate} hovered={showControls} />
      case 'note':  return <NoteCard item={item} onUpdate={onUpdate} hovered={showControls} />
      case 'link':  return <LinkCard item={item} onUpdate={onUpdate} hovered={showControls} />
      default: return null
    }
  }

  // Hover/select outline is intentionally subtle — the item should feel
  // like a free-floating object, not a dashboard card.
  const outline = selected
    ? '0 0 0 2px var(--accent), 0 10px 30px rgba(0,0,0,0.55)'
    : hovered
      ? '0 0 0 1px rgba(108,99,255,0.45), 0 10px 30px rgba(0,0,0,0.5)'
      : '0 6px 22px rgba(0,0,0,0.45)'

  // Resize handles sit *inside* the wrapper at the corners so hovering
  // them keeps the wrapper's hover state alive. They are pointer-event-
  // disabled when invisible so they can never silently steal clicks from
  // items the user can't see they're hitting. Hover-only controls placed
  // in corners (note swatches at top-left, video controls at bottom-left)
  // use zIndex >= 30 so they outrank the corner handles when both visible.
  const handleSize = 18
  const interactive = showControls && !locked
  const corner = (extra) => ({
    width: handleSize,
    height: handleSize,
    background: 'transparent',
    opacity: interactive ? 0.6 : 0,
    pointerEvents: interactive ? 'auto' : 'none',
    transition: 'opacity 0.15s',
    zIndex: 25,
    ...extra,
  })
  const edge = (extra) => ({
    background: 'transparent',
    opacity: interactive ? 1 : 0,
    pointerEvents: interactive ? 'auto' : 'none',
    transition: 'opacity 0.15s',
    zIndex: 25,
    ...extra,
  })

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
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ zIndex: item.zIndex }}
      minWidth={120}
      minHeight={80}
      bounds="parent"
      cancel={DRAG_CANCEL}
      disableDragging={locked}
      enableResizing={!locked}
      resizeHandleStyles={{
        bottomRight: corner({ right: 0, bottom: 0, cursor: 'nwse-resize' }),
        bottomLeft:  corner({ left: 0, bottom: 0, cursor: 'nesw-resize' }),
        topRight:    corner({ right: 0, top: 0, cursor: 'nesw-resize' }),
        topLeft:     corner({ left: 0, top: 0, cursor: 'nwse-resize' }),
        right:  edge({ width: 6, right: -3, top: 18, bottom: 18, cursor: 'ew-resize' }),
        left:   edge({ width: 6, left: -3, top: 18, bottom: 18, cursor: 'ew-resize' }),
        top:    edge({ height: 6, top: -3, left: 18, right: 18, cursor: 'ns-resize' }),
        bottom: edge({ height: 6, bottom: -3, left: 18, right: 18, cursor: 'ns-resize' }),
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          borderRadius: 'var(--radius)',
          overflow: 'hidden',
          boxShadow: outline,
          // Keep default cursor on idle so the canvas feels like a mural, not
          // a draggable dashboard. We avoid setting 'grab' here so it never
          // visually competes with the resize handles' cursors at the corners.
          cursor: locked ? 'default' : 'default',
          transition: 'box-shadow 0.18s ease',
        }}
      >
        {/* Item content fills the whole surface — no header strip. */}
        <div style={{ width: '100%', height: '100%' }}>
          {renderContent()}
        </div>

        {/* Floating mini-toolbar — visible only on hover or selection. */}
        <div
          className="no-drag"
          style={{
            position: 'absolute',
            top: 6,
            right: 6,
            display: 'flex',
            gap: 2,
            padding: 3,
            background: 'rgba(15,15,16,0.82)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 8,
            backdropFilter: 'blur(8px)',
            opacity: showControls ? 1 : 0,
            pointerEvents: showControls ? 'auto' : 'none',
            transition: 'opacity 0.15s',
            zIndex: 20,
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <IconBtn
            title={locked ? 'Unlock' : 'Lock'}
            onClick={() => onUpdate(item.id, { locked: !locked })}
            highlight={locked}
          >
            {locked ? '🔒' : '🔓'}
          </IconBtn>
          <IconBtn
            title="Duplicate"
            onClick={() => onDuplicate && onDuplicate(item.id)}
          >
            ⧉
          </IconBtn>
          <IconBtn
            title="Delete"
            onClick={() => onRemove(item.id)}
            danger
          >
            ✕
          </IconBtn>
        </div>

        {/* Subtle resize affordance — corner glyph that fades in with controls. */}
        {!locked && (
          <div
            aria-hidden
            style={{
              position: 'absolute',
              right: 3,
              bottom: 1,
              fontSize: 12,
              lineHeight: '12px',
              color: 'rgba(255,255,255,0.5)',
              userSelect: 'none',
              pointerEvents: 'none',
              opacity: showControls ? 0.6 : 0,
              transition: 'opacity 0.15s',
              zIndex: 15,
            }}
          >
            ⌟
          </div>
        )}
      </div>
    </Rnd>
  )
}

function IconBtn({ children, onClick, title, highlight, danger }) {
  const [hov, setHov] = useState(false)
  const bg = danger
    ? (hov ? 'var(--danger)' : 'rgba(255,79,79,0.18)')
    : highlight
      ? 'var(--accent)'
      : (hov ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.06)')
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick && onClick(e) }}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      title={title}
      style={{
        background: bg,
        color: '#fff',
        border: 'none',
        borderRadius: 5,
        width: 22,
        height: 20,
        fontSize: 11,
        lineHeight: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'background 0.12s',
      }}
    >
      {children}
    </button>
  )
}
