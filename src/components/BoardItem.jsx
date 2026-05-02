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

// Allowed opacity steps for the cycle button. High → low; clicking the
// button cycles through these in order and wraps. The values are stored
// raw on the item (`item.opacity`) and applied directly to the content
// layer's CSS `opacity`. Existing items without the field default to 1
// at read time — we never write the default back, so old layouts stay
// byte-identical until the user touches the control.
const OPACITY_STEPS = [1, 0.75, 0.5, 0.3]

// Map an opacity value (any number 0..1) to a single-glyph fill icon so
// the button visually reflects the current state without needing extra
// chars / a percentage label. Buckets favor the higher value when the
// opacity is between two steps (e.g. 0.6 → ◐ for 50%, 0.85 → ◕ for 75%).
function opacityIcon(o) {
  if (o >= 0.875) return '●' // 100%
  if (o >= 0.625) return '◕' // 75%
  if (o >= 0.4)   return '◐' // 50%
  return '◔'                  // 30%
}

export default function BoardItem({
  item,
  selected,
  onUpdate,
  onRemove,
  onFocus,
  onSelect,
  onDuplicate,
  onHoverChange,
}) {
  const [hovered, setHovered] = useState(false)
  const locked = !!item.locked
  const showControls = hovered || selected

  // Notify the parent (App) that this card's hover state changed so
  // the floating toolbar can reveal itself when any card is hovered
  // in Electron transparent-overlay mode.
  function notifyHover(next) {
    setHovered(next)
    if (onHoverChange) onHoverChange(item.id, next)
  }

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

  // Per-item opacity / fit (see OPACITY_STEPS + opacityIcon). Both
  // controls live in the existing hover-only mini-toolbar, so they
  // appear and disappear with the rest of the card affordances and
  // never make the canvas feel app-like.
  const itemOpacity = typeof item.opacity === 'number' ? item.opacity : 1
  const itemFit = item.fit === 'contain' ? 'contain' : 'cover'
  const supportsFit = item.type === 'image' || item.type === 'video'

  function cycleOpacity() {
    // Find the current step (using a small epsilon so 0.299999...
    // still matches 0.3 after a JSON round-trip). If the current
    // value isn't one of our steps (e.g. something an external
    // import wrote), fall back to step 0 → next will be 0.75.
    const cur = itemOpacity
    const idx = OPACITY_STEPS.findIndex((v) => Math.abs(v - cur) < 0.001)
    const next = OPACITY_STEPS[(idx === -1 ? 0 : idx + 1) % OPACITY_STEPS.length]
    onUpdate(item.id, { opacity: next })
  }

  function toggleFit() {
    onUpdate(item.id, { fit: itemFit === 'cover' ? 'contain' : 'cover' })
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
  // like a free-floating object, not a dashboard card. Selected uses a
  // crisp accent ring; hover uses a soft border that hints the card is
  // alive without competing visually with selection.
  const outline = selected
    ? '0 0 0 1.5px var(--accent), 0 0 0 5px var(--accent-soft), 0 14px 36px rgba(0,0,0,0.55)'
    : hovered
      ? '0 0 0 1px var(--border-strong), 0 12px 32px rgba(0,0,0,0.5)'
      : '0 8px 24px rgba(0,0,0,0.42)'

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
      // muraldesk-card-rnd marks this rectangle as an interactive
      // zone for the Electron click-through hook
      // (src/hooks/useElectronClickThrough.js): when the cursor is
      // anywhere over a card, the OS-level click-through is OFF so
      // drag / resize / click work as expected. Outside any card the
      // transparent canvas becomes click-through.
      className="muraldesk-card-rnd"
      position={{ x: item.x, y: item.y }}
      size={{ width: item.width, height: item.height }}
      onDragStop={handleDragStop}
      onResizeStop={handleResizeStop}
      onMouseDown={() => {
        onFocus(item.id)
        onSelect && onSelect(item.id)
      }}
      onMouseEnter={() => notifyHover(true)}
      onMouseLeave={() => notifyHover(false)}
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
          // Keep default cursor on idle so the canvas feels like a mural, not
          // a draggable dashboard. We avoid setting 'grab' here so it never
          // visually competes with the resize handles' cursors at the corners.
          cursor: locked ? 'default' : 'default',
        }}
      >
        {/*
          Faded content layer. The shadow + rounded clipping live HERE
          (not on the outer wrapper) so they fade together with the
          content when item.opacity < 1. The mini-toolbar and resize
          glyph are siblings of this layer — they sit OUTSIDE the
          opacity cascade so the user can always see + click the
          controls even on a 30%-opacity item. CSS opacity is
          multiplicative with parent so the only correct way to
          "exempt" the toolbar is to host it on a separate sibling
          (which we do below).
        */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 'var(--radius)',
            overflow: 'hidden',
            boxShadow: outline,
            opacity: itemOpacity,
            transition: 'opacity var(--t-fast) var(--ease-out), box-shadow var(--t-med) var(--ease-out)',
          }}
        >
          {/* Item content fills the whole surface — no header strip. */}
          <div style={{ width: '100%', height: '100%' }}>
            {renderContent()}
          </div>
        </div>

        {/* Floating mini-toolbar — visible only on hover or selection.
            Sits outside the faded content layer so its readability is
            independent of item.opacity. */}
        <div
          className="no-drag"
          style={{
            position: 'absolute',
            top: 7,
            right: 7,
            display: 'flex',
            gap: 2,
            padding: 3,
            background: 'var(--surface-glass-strong)',
            border: '1px solid var(--border)',
            borderRadius: 9,
            backdropFilter: 'blur(12px) saturate(160%)',
            WebkitBackdropFilter: 'blur(12px) saturate(160%)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            opacity: showControls ? 1 : 0,
            transform: showControls ? 'translateY(0)' : 'translateY(-4px)',
            pointerEvents: showControls ? 'auto' : 'none',
            transition: 'opacity var(--t-fast) var(--ease-out), transform var(--t-fast) var(--ease-out)',
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
          {/* Opacity cycle — applies to all item types. The glyph
              visually mirrors the current step (●/◕/◐/◔) so users
              can read the level at a glance; the title shows the
              precise percentage and how to advance. */}
          <IconBtn
            title={`Opacity ${Math.round(itemOpacity * 100)}% — click to cycle`}
            onClick={cycleOpacity}
            highlight={itemOpacity < 1}
          >
            {opacityIcon(itemOpacity)}
          </IconBtn>
          {/* Fit toggle — image/video only. Highlighted in 'contain'
              mode (the non-default state) so the user can see at a
              glance which items are letterboxed. */}
          {supportsFit && (
            <IconBtn
              title={`Fit: ${itemFit} — click to toggle`}
              onClick={toggleFit}
              highlight={itemFit === 'contain'}
            >
              {itemFit === 'cover' ? '▣' : '▢'}
            </IconBtn>
          )}
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
    ? (hov ? 'var(--danger)' : 'var(--danger-soft)')
    : highlight
      ? 'var(--accent)'
      : (hov ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.04)')
  const color = danger
    ? '#fff'
    : highlight
      ? '#fff'
      : (hov ? 'var(--text)' : 'var(--text-muted)')
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
        color,
        border: 'none',
        borderRadius: 6,
        width: 24,
        height: 22,
        fontSize: 11,
        lineHeight: '22px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'background var(--t-fast) var(--ease-out), color var(--t-fast) var(--ease-out)',
      }}
    >
      {children}
    </button>
  )
}
