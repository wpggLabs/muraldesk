import { useEffect, useRef, useState } from 'react'
import { classifyLink } from '../lib/linkType'

// Renders one of four variants depending on the URL:
//   - youtube  → muted-loop embed (drag-friendly via pointer-events:none)
//   - video    → playable <video> with hover-only mute / loop controls
//   - image    → inline <img>
//   - web      → original favicon + Open button card
//   - unsafe   → non-clickable "Unsafe URL" placeholder
//
// All variants are draggable from anywhere in the card except the explicit
// `.no-drag` interactive sub-elements, which is what BoardItem's react-rnd
// `cancel` selector targets.
export default function LinkCard({ item, hovered, onUpdate }) {
  const c = classifyLink(item.url || '')

  if (c.kind === 'youtube') {
    return <YouTubeEmbed item={item} info={c} hovered={hovered} />
  }
  if (c.kind === 'video') {
    return <RemoteVideo item={item} info={c} hovered={hovered} onUpdate={onUpdate} />
  }
  if (c.kind === 'image') {
    return <RemoteImage item={item} info={c} />
  }
  return <WebLink item={item} info={c} />
}

// ----- YouTube ---------------------------------------------------------------

// YouTube cards have two modes:
//   - Default (idle): iframe is `pointer-events: none` so the whole card
//     is draggable from anywhere. The video autoplays muted and looped.
//   - Interact: clicking the hover-only "Interact" button flips the iframe
//     to `pointer-events: auto`, letting the user use YouTube's native
//     player UI. To still allow moving the card in this mode, a slim drag
//     strip appears at the top of the card (a plain <div>, NOT marked
//     `.no-drag`, so react-rnd treats it as a drag origin).
//
// Interact state is intentionally per-card *transient* React state: it
// resets to off on reload, so we don't have to migrate persisted layouts
// or worry about stale interact flags in exported JSON.
function YouTubeEmbed({ item, info, hovered }) {
  const [interact, setInteract] = useState(false)

  // Esc exits interact mode while the parent window has focus. If the
  // user has focused the iframe itself (e.g. clicked YouTube's play
  // button), the cross-origin iframe captures keypresses and this won't
  // fire — they can fall back to the visible "Exit interact" button.
  useEffect(() => {
    if (!interact) return
    function onKey(e) {
      if (e.key === 'Escape') setInteract(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [interact])

  // Show the bottom-left chrome whenever the card is hovered OR currently
  // interacting (so the Exit button stays reachable even if the hover
  // state is lost while the mouse is over the iframe).
  const showChrome = hovered || interact

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#000' }}>
      <iframe
        src={info.embedSrc}
        title={item.title || 'YouTube video'}
        allow="autoplay; encrypted-media; picture-in-picture"
        loading="lazy"
        style={{
          width: '100%',
          height: '100%',
          border: 0,
          display: 'block',
          pointerEvents: interact ? 'auto' : 'none',
        }}
      />

      {/* Drag strip at top — only in interact mode. This is a plain div,
          not in the BoardItem `cancel` selector, so mousedown bubbles up
          to react-rnd and starts a drag. zIndex sits above the iframe but
          below the mini-toolbar (z:20) and corner handles (z:25) so those
          still win clicks at their respective regions. */}
      {interact && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 26,
            background: 'linear-gradient(rgba(0,0,0,0.65), rgba(0,0,0,0))',
            cursor: 'grab',
            display: 'flex',
            alignItems: 'center',
            paddingLeft: 10,
            color: 'rgba(255,255,255,0.85)',
            fontSize: 10,
            letterSpacing: 0.6,
            textTransform: 'uppercase',
            zIndex: 18,
            userSelect: 'none',
          }}
          title="Drag to move"
        >
          ⋮⋮ Drag
        </div>
      )}

      {/* Bottom-left controls. Marked .no-drag so clicks here never start
          a drag. zIndex above corner handles so they always win at the
          bottom-left even when handles are visible. */}
      <div
        className="no-drag"
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          position: 'absolute',
          bottom: 8,
          left: 8,
          display: 'flex',
          gap: 4,
          zIndex: 30,
          opacity: showChrome ? 1 : 0,
          pointerEvents: showChrome ? 'auto' : 'none',
          transition: 'opacity 0.15s',
        }}
      >
        {interact ? (
          <button
            type="button"
            onClick={() => setInteract(false)}
            title="Exit interact mode (Esc)"
            style={{ ...ytBtn, background: 'rgba(var(--accent-rgb), 0.85)' }}
          >
            ✕ Exit interact
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setInteract(true)}
            title="Click to interact with the player"
            style={ytBtn}
          >
            ▶ Interact
          </button>
        )}
        <a
          href={info.watchUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="Open on YouTube"
          style={{ ...ytBtn, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
        >
          ↗
        </a>
      </div>
    </div>
  )
}

// ----- Direct video URL ------------------------------------------------------

function RemoteVideo({ item, info, hovered, onUpdate }) {
  const videoRef = useRef(null)
  const muted = item.muted !== false
  const loop = item.loop !== false
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#000' }}>
      <video
        ref={videoRef}
        src={info.url}
        autoPlay
        loop={loop}
        muted={muted}
        playsInline
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
          pointerEvents: 'none',
        }}
        onError={() => { /* let the user fall back to opening the URL */ }}
      />
      <div
        className="no-drag"
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          position: 'absolute',
          bottom: 8,
          left: 8,
          display: 'flex',
          gap: 4,
          zIndex: 30,
          opacity: hovered ? 1 : 0,
          pointerEvents: hovered ? 'auto' : 'none',
          transition: 'opacity 0.15s',
        }}
      >
        <button
          type="button"
          title={muted ? 'Unmute' : 'Mute'}
          onClick={() => {
            const v = videoRef.current
            const next = v ? !v.muted : !muted
            if (v) v.muted = next
            onUpdate && onUpdate(item.id, { muted: next })
          }}
          style={ctrlBtn}
        >
          {muted ? '🔇' : '🔊'}
        </button>
        <button
          type="button"
          title={loop ? 'Loop on' : 'Loop off'}
          onClick={() => onUpdate && onUpdate(item.id, { loop: !loop })}
          style={{
            ...ctrlBtn,
            background: loop ? 'rgba(var(--accent-rgb), 0.75)' : ctrlBtn.background,
          }}
        >
          ↻
        </button>
      </div>
    </div>
  )
}

// ----- Direct image URL ------------------------------------------------------

function RemoteImage({ item, info }) {
  return (
    <div style={{ width: '100%', height: '100%', background: '#000' }}>
      <img
        src={info.url}
        alt={item.title || ''}
        draggable={false}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
          pointerEvents: 'none',
        }}
      />
    </div>
  )
}

// ----- Plain web URL ---------------------------------------------------------

function WebLink({ item, info }) {
  const safe = info.kind === 'web'
  const hostname = safe ? info.hostname : ''
  const safeUrl = safe ? info.url : ''
  const faviconUrl = hostname
    ? `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`
    : null

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        // Top padding leaves room for the floating mini-toolbar.
        padding: '34px 14px 14px',
        background: 'var(--surface2)',
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        {faviconUrl && (
          <img
            src={faviconUrl}
            alt=""
            draggable={false}
            style={{ width: 16, height: 16, borderRadius: 3, flexShrink: 0, pointerEvents: 'none' }}
          />
        )}
        <span
          style={{
            color: 'var(--text-muted)',
            fontSize: 11,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {hostname || 'Link'}
        </span>
      </div>
      {item.title && (
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6, color: 'var(--text)', lineHeight: 1.4 }}>
          {item.title}
        </div>
      )}
      {item.description && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4, flex: 1, overflow: 'hidden' }}>
          {item.description}
        </div>
      )}
      {safeUrl ? (
        <a
          className="no-drag"
          onMouseDown={(e) => e.stopPropagation()}
          href={safeUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-block',
            marginTop: 10,
            padding: '4px 10px',
            background: 'var(--accent)',
            color: '#fff',
            borderRadius: 5,
            fontSize: 12,
            textDecoration: 'none',
            alignSelf: 'flex-start',
          }}
        >
          Open →
        </a>
      ) : (
        <span
          title="Link blocked: only http(s) URLs are allowed"
          style={{
            display: 'inline-block',
            marginTop: 10,
            padding: '4px 10px',
            background: 'var(--surface)',
            color: 'var(--text-muted)',
            border: '1px dashed var(--border)',
            borderRadius: 5,
            fontSize: 12,
            alignSelf: 'flex-start',
          }}
        >
          Unsafe URL
        </span>
      )}
    </div>
  )
}

const ctrlBtn = {
  background: 'rgba(0,0,0,0.65)',
  color: '#fff',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 5,
  padding: '3px 7px',
  fontSize: 11,
  cursor: 'pointer',
}

const ytBtn = {
  ...ctrlBtn,
  padding: '4px 9px',
  fontWeight: 500,
}
