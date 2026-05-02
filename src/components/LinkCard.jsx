import { useRef } from 'react'
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

function YouTubeEmbed({ item, info, hovered }) {
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
          // Iframe is purely visual ambient playback so the parent canvas
          // can still receive drag events from anywhere on the card. To
          // actually watch with sound, the user follows the hover-only
          // "YouTube" link to the original page.
          pointerEvents: 'none',
        }}
      />
      <a
        className="no-drag"
        onMouseDown={(e) => e.stopPropagation()}
        href={info.watchUrl}
        target="_blank"
        rel="noopener noreferrer"
        title="Open on YouTube"
        style={{
          position: 'absolute',
          bottom: 8,
          left: 8,
          padding: '4px 8px',
          background: 'rgba(0,0,0,0.7)',
          color: '#fff',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 5,
          fontSize: 11,
          textDecoration: 'none',
          opacity: hovered ? 1 : 0,
          pointerEvents: hovered ? 'auto' : 'none',
          transition: 'opacity 0.15s',
          zIndex: 30,
        }}
      >
        ▶ YouTube
      </a>
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
            background: loop ? 'rgba(108,99,255,0.75)' : ctrlBtn.background,
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
