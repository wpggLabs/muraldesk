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
  // Snap-to-grid props (driven by useSnap in App). When `snap` is true
  // we pass react-rnd's native dragGrid + resizeGrid so the underlying
  // react-draggable / react-resizable libraries handle the actual
  // pixel-rounding — we don't reinvent the snap math. We additionally
  // render two faint alignment guide lines at the card's center while
  // a drag/resize is in progress, as a visual hint that snapping is
  // active.
  snap = false,
  snapGrid = 24,
  // Board-level opacity multiplier (driven by useBoardView in App).
  // Applied at render time to the content layer only, multiplicative
  // with this item's persisted `item.opacity`. The mini-toolbar +
  // resize handles + corner glyph are siblings of the content layer
  // and therefore unaffected — hover controls stay fully readable
  // even at boardOpacity = 0.3. The persisted item shape is NOT
  // mutated, so refresh / export / import round-trip unchanged.
  boardOpacity = 1,
  // Single-card Focus mode (transient — owned by App). Double-click
  // sets focusedItemId in App; App passes `focused={true}` back to
  // the matching BoardItem, which renders a centered, enlarged
  // overlay clone of the card content. NO geometry mutation.
  focused = false,
  onRequestFocus,
  onExitFocus,
  isElectron = false,
}) {
  const [hovered, setHovered] = useState(false)
  // Live drag/resize state used solely to render the alignment guide
  // lines while the user is moving or resizing the card. We do NOT
  // call onUpdate on every drag/resize tick — react-rnd already
  // batches that into onDragStop / onResizeStop, and per-tick state
  // updates would thrash the items array (and re-render every other
  // card on the board). Local state is enough because the guide lines
  // live inside this BoardItem's render output.
  const [activeRect, setActiveRect] = useState(null)
  const locked = !!item.locked
  const showControls = hovered || selected

  // Notify the parent (App) that this card's hover state changed so
  // the floating toolbar can reveal itself when any card is hovered
  // in Electron transparent-overlay mode.
  function notifyHover(next) {
    setHovered(next)
    if (onHoverChange) onHoverChange(item.id, next)
  }

  // All guide-state lifecycle calls below are gated behind `snap`.
  // When snap is OFF we never call setActiveRect at any phase of the
  // drag/resize lifecycle, so the snap-OFF render path is byte-identical
  // to the pre-snap implementation (no extra local re-renders, no extra
  // hot-path setState — only the original onUpdate at the end).
  function handleDragStart() {
    if (!snap) return
    // Seed the guide-line state with the card's current position so
    // the lines appear immediately on drag start, not after the first
    // mousemove tick.
    setActiveRect({ x: item.x, y: item.y, width: item.width, height: item.height })
  }

  function handleDrag(e, d) {
    if (!snap) return
    setActiveRect((prev) => prev
      ? { ...prev, x: d.x, y: d.y }
      : { x: d.x, y: d.y, width: item.width, height: item.height })
  }

  function handleDragStop(e, d) {
    if (snap) setActiveRect(null)
    onUpdate(item.id, { x: d.x, y: d.y })
  }

  function handleResizeStart() {
    if (!snap) return
    setActiveRect({ x: item.x, y: item.y, width: item.width, height: item.height })
  }

  function handleResize(e, dir, ref, delta, pos) {
    if (!snap) return
    setActiveRect({
      x: pos.x,
      y: pos.y,
      width: parseInt(ref.style.width),
      height: parseInt(ref.style.height),
    })
  }

  function handleResizeStop(e, dir, ref, delta, pos) {
    if (snap) setActiveRect(null)
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

  // react-rnd's grid props expect `[x, y]` arrays. Passing `undefined`
  // (rather than `[1, 1]`) keeps the un-snapped path completely
  // unchanged — the underlying react-draggable / react-resizable code
  // skips its grid logic entirely when the prop is missing, so snap-OFF
  // behavior is byte-identical to the pre-snap implementation.
  const gridArr = snap ? [snapGrid, snapGrid] : undefined

  // Alignment guide lines. Rendered as two thin position:fixed bars
  // at the card's current center (vertical line at center-X, horizontal
  // line at center-Y), only while a drag or resize is in progress AND
  // snap is on. pointerEvents: none means they NEVER affect the
  // click-through hit-test in Electron transparent-overlay mode — they
  // are pure decoration.
  const guides = snap && activeRect ? (
    <>
      <div
        aria-hidden
        style={{
          position: 'fixed',
          top: 0,
          bottom: 0,
          left: Math.round(activeRect.x + activeRect.width / 2),
          width: 1,
          background: 'var(--accent)',
          opacity: 0.22,
          pointerEvents: 'none',
          zIndex: 9998,
        }}
      />
      <div
        aria-hidden
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          top: Math.round(activeRect.y + activeRect.height / 2),
          height: 1,
          background: 'var(--accent)',
          opacity: 0.22,
          pointerEvents: 'none',
          zIndex: 9998,
        }}
      />
    </>
  ) : null

  return (
    <>
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
      onDragStart={handleDragStart}
      onDrag={handleDrag}
      onDragStop={handleDragStop}
      onResizeStart={handleResizeStart}
      onResize={handleResize}
      onResizeStop={handleResizeStop}
      // dragGrid / resizeGrid are react-rnd passthroughs to the
      // underlying react-draggable / react-resizable libraries. When
      // undefined (snap OFF) the libraries skip their grid logic and
      // behavior is identical to the pre-snap implementation.
      dragGrid={gridArr}
      resizeGrid={gridArr}
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
        onDoubleClick={(e) => {
          // Double-click anywhere on the card body enters Focus mode.
          // Skipped on .no-drag descendants (mini-toolbar, link chrome,
          // textarea, video controls) so double-clicking text to select
          // a word, or double-clicking the link "Open" button, doesn't
          // trigger Focus. .closest('.no-drag') walks up to catch
          // children of the chrome bars too.
          if (e.target && e.target.closest && e.target.closest('.no-drag, textarea, input, button, a')) return
          if (onRequestFocus) onRequestFocus()
        }}
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
            // Board-level fade is multiplicative with the per-item
            // opacity. When boardOpacity === 1 the value is identical
            // to the pre-feature (item-only) opacity, so the no-fade
            // render path is byte-identical to before this feature
            // was added.
            opacity: itemOpacity * boardOpacity,
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
            top: 6,
            right: 6,
            display: 'flex',
            gap: 1,
            padding: 2,
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
    {guides}
    {focused && (
      <FocusOverlay
        isElectron={isElectron}
        onExit={onExitFocus}
        renderContent={renderContent}
      />
    )}
    </>
  )
}

// Centered, enlarged overlay copy of the card content. Rendered
// ABOVE the board (z-index 9990 — below the link dialog at 99999
// and below the alignment guides' z-index but above every Rnd
// card). The original Rnd stays mounted underneath at its original
// position/size — we never touch item.x/y/width/height — so on
// exit (Esc, click backdrop, click ✕) the layout snaps back exactly
// as it was, and a page refresh while focused has no persisted
// effect at all.
//
// Web build: paints a subtle dark backdrop + blur so the focused
// card visually pops against the board.
// Electron transparent-overlay build (`isElectron`): renders NO
// backdrop — just the centered content. The container is still
// pointer-events: none so empty space stays click-through, with
// pointer-events: auto restored on the actual focused card and on
// the floating Exit button so the user can interact with both.
//
// data-muraldesk-interactive="true" on the focused card surface
// keeps the Electron click-through hook treating the focused
// region as fully interactive — same convention the toolbar / link
// dialog / shortcuts modal already use.
function FocusOverlay({ isElectron, onExit, renderContent }) {
  // Re-create the same chunk of card DOM the Rnd renders, but at
  // viewport-centered, ~80%-sized geometry. The card content is
  // re-mounted (new React subtree) — Interact mode in iframes resets
  // because that's per-card transient state in LinkCard. That's the
  // right tradeoff: Focus is a quick "look at this" gesture, and
  // re-mounting keeps the implementation simple and avoids any
  // ambiguity about which copy "owns" the iframe.
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Focused card"
      data-muraldesk-interactive="true"
      onClick={(e) => {
        // Click on the backdrop (the overlay root itself) exits.
        // Clicks on the focused card stop-propagation below so they
        // never reach this handler.
        if (e.target === e.currentTarget) onExit && onExit()
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9990,
        // Web: subtle dim + blur. Electron transparent-overlay: no
        // background at all so the desktop underneath stays visible
        // — the user opted into a transparent mural and we respect it.
        background: isElectron ? 'transparent' : 'rgba(0,0,0,0.55)',
        backdropFilter: isElectron ? 'none' : 'blur(8px)',
        WebkitBackdropFilter: isElectron ? 'none' : 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        // In Electron with no backdrop, leave the empty space click-
        // through so the desktop underneath still receives clicks
        // outside the focused card. The card itself re-enables
        // pointer-events below.
        pointerEvents: isElectron ? 'none' : 'auto',
        animation: 'muraldesk-overlay-in 200ms var(--ease-out) both',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          width: 'min(80vw, 1100px)',
          height: 'min(80vh, 720px)',
          borderRadius: 'var(--radius)',
          overflow: 'hidden',
          boxShadow: '0 24px 60px rgba(0,0,0,0.55), 0 0 0 1px var(--border-strong)',
          background: 'var(--surface)',
          pointerEvents: 'auto',
          animation: 'muraldesk-dialog-in 220ms var(--ease-out) both',
        }}
      >
        {renderContent()}
        {/* Exit affordance — top-right, .no-drag so it never starts
            a (non-existent in this overlay, but kept for consistency)
            drag, and stops propagation so the click never reaches
            the backdrop's exit handler. */}
        <button
          type="button"
          className="no-drag"
          onClick={(e) => { e.stopPropagation(); onExit && onExit() }}
          onMouseDown={(e) => e.stopPropagation()}
          title="Exit Focus (Esc)"
          aria-label="Exit Focus mode"
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            zIndex: 40,
            background: 'rgba(0,0,0,0.65)',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 6,
            padding: '4px 9px',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          ✕ Exit Focus
        </button>
      </div>
    </div>
  )
}

function IconBtn({ children, onClick, title, highlight, danger }) {
  const [hov, setHov] = useState(false)
  // The mini-toolbar surface uses --surface-glass-strong, so the
  // hover/idle button tints come from the same theme tokens the
  // toolbar pills use — that way light mode shows a black-on-white
  // tint instead of the previous hardcoded white-on-white (invisible).
  const bg = danger
    ? (hov ? 'var(--danger)' : 'var(--danger-soft)')
    : highlight
      ? 'var(--accent)'
      : (hov ? 'var(--btn-hover-strong)' : 'var(--btn-idle)')
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
        borderRadius: 5,
        width: 20,
        height: 18,
        fontSize: 10,
        lineHeight: '18px',
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
