import { useEffect, useRef, useState } from 'react'
import { classifyLink } from '../lib/linkType'

// Renders one of several variants depending on the URL:
//   - youtube     → muted-loop YouTube embed (drag-friendly idle, Interact toggle)
//   - vimeo       → muted-loop Vimeo embed (drag-friendly idle, Interact toggle)
//   - soundcloud  → SoundCloud widget (drag-friendly idle, Interact to play)
//   - spotify     → Spotify /embed/ player (drag-friendly idle, Interact to play)
//   - codepen     → CodePen rendered-result iframe (drag-friendly idle, Interact)
//   - video       → playable <video> with hover-only mute / loop controls
//   - image       → inline <img>
//   - web         → original favicon + Open button card
//   - unsafe      → non-clickable "Unsafe URL" placeholder
//
// All variants are draggable from anywhere in the card except the explicit
// `.no-drag` interactive sub-elements, which is what BoardItem's react-rnd
// `cancel` selector targets.
//
// Iframe security defenses live below in IframeEmbed and YouTubeEmbed:
//   - referrerPolicy="strict-origin-when-cross-origin" — embed origins
//     only receive the parent's origin, never the full URL/path, even
//     if MuralDesk is later hosted on a real domain.
//   - sandbox="allow-scripts allow-same-origin allow-popups
//             allow-popups-to-escape-sandbox allow-presentation"
//     blocks form submission, top-level navigation, downloads, modals,
//     pointer-lock, orientation-lock, and the storage-access prompt.
//     allow-same-origin is intentionally present because every supported
//     player relies on first-party storage (preferences, login, DRM).
//   - allow="…" enumerates only the feature-policy permissions each
//     player actually needs (autoplay / encrypted-media / etc.) — never
//     a blanket allowall.
export default function LinkCard({ item, hovered, onUpdate }) {
  const c = classifyLink(item.url || '')

  if (c.kind === 'youtube') {
    return <YouTubeEmbed item={item} info={c} hovered={hovered} />
  }
  if (c.kind === 'vimeo') {
    return (
      <IframeEmbed
        item={item}
        info={c}
        hovered={hovered}
        label="Vimeo video"
        // Vimeo background-mode autoplays muted+looped; pip + fullscreen
        // are useful when the user enters Interact.
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        background="#000"
      />
    )
  }
  if (c.kind === 'soundcloud') {
    return (
      <IframeEmbed
        item={item}
        info={c}
        hovered={hovered}
        label="SoundCloud track"
        allow="autoplay; encrypted-media"
        // SoundCloud's widget paints its own gradient — `transparent`
        // lets it bleed without a black letterbox on small cards.
        background="transparent"
      />
    )
  }
  if (c.kind === 'spotify') {
    return (
      <IframeEmbed
        item={item}
        info={c}
        hovered={hovered}
        label="Spotify player"
        // clipboard-write supports Spotify's "share" copy button when
        // the user is in Interact; the rest are standard player needs.
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        background="#000"
      />
    )
  }
  if (c.kind === 'codepen') {
    return (
      <IframeEmbed
        item={item}
        info={c}
        hovered={hovered}
        label="CodePen demo"
        // clipboard-write covers any "Copy code" button in the embed UI.
        allow="clipboard-write"
        background="#1e1f26"
      />
    )
  }
  if (c.kind === 'video') {
    return <RemoteVideo item={item} info={c} hovered={hovered} onUpdate={onUpdate} />
  }
  if (c.kind === 'image') {
    return <RemoteImage item={item} info={c} hovered={hovered} />
  }
  return <WebLink item={item} info={c} hovered={hovered} />
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
      {interact && <DragStrip />}

      {/* Bottom-left controls. Marked .no-drag so clicks here never start
          a drag. zIndex above corner handles so they always win at the
          bottom-left even when handles are visible. */}
      <ChromeBar visible={showChrome}>
        <InteractToggle interact={interact} setInteract={setInteract} />
        <OpenLink href={info.watchUrl} title="Open on YouTube" />
        <CopyLink url={info.watchUrl} title="Copy YouTube URL" />
      </ChromeBar>
    </div>
  )
}

// ----- Generic safe-iframe embed --------------------------------------------

// Shared component for Vimeo / SoundCloud / Spotify / CodePen. Same
// Interact pattern as YouTubeEmbed (see above) — the only differences
// are which `allow` features to forward, which background color to
// paint while the iframe loads, and a per-platform `label` used as the
// fallback iframe title when the item has no user-supplied title.
//
// The iframe's `sandbox` attribute is set here (NOT on YouTubeEmbed —
// see the file header for why we leave YouTube as it was). The chosen
// permissions match what every player in this family needs:
//   - allow-scripts                       run the player JS
//   - allow-same-origin                   first-party storage / cookies
//   - allow-popups                        "Open in app" → external tab
//   - allow-popups-to-escape-sandbox      that tab is a clean window,
//                                         not another sandboxed iframe
//   - allow-presentation                  cast / fullscreen presentation
// Notably MISSING (intentional): allow-forms (no need), allow-modals
// (blocks alert() spam), allow-top-navigation* (prevents the embed from
// redirecting the host page), allow-downloads, allow-pointer-lock,
// allow-orientation-lock, allow-storage-access-by-user-activation.
function IframeEmbed({ item, info, hovered, label, allow, background = '#000' }) {
  const [interact, setInteract] = useState(false)

  useEffect(() => {
    if (!interact) return
    function onKey(e) {
      if (e.key === 'Escape') setInteract(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [interact])

  const showChrome = hovered || interact

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background }}>
      <iframe
        src={info.embedSrc}
        title={item.title || label}
        allow={allow}
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-presentation"
        style={{
          width: '100%',
          height: '100%',
          border: 0,
          display: 'block',
          pointerEvents: interact ? 'auto' : 'none',
          // colorScheme: 'dark' helps SoundCloud/Spotify pick their dark
          // skin even if the host page later flips to a light theme; it
          // doesn't affect any provider that ignores it.
          colorScheme: 'dark',
        }}
      />

      {interact && <DragStrip />}

      <ChromeBar visible={showChrome}>
        <InteractToggle interact={interact} setInteract={setInteract} />
        <OpenLink href={info.watchUrl} title={`Open ${label}`} />
        <CopyLink url={info.watchUrl} title={`Copy ${label} URL`} />
      </ChromeBar>
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
        {/* Open + Copy on direct video URL — only meaningful when there's
            a real http(s) URL (classifyLink already guarantees this for
            kind === 'video') so they're always safe to render here. */}
        <OpenLink href={info.url} title="Open original video" />
        <CopyLink url={info.url} title="Copy video URL" />
      </div>
    </div>
  )
}

// ----- Direct image URL ------------------------------------------------------

// Hover chrome added so the user can open the original image in a new
// tab or copy its URL. Marked .no-drag and stops mousedown so the
// buttons don't start a card drag. Hidden until hovered.
function RemoteImage({ item, info, hovered }) {
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#000' }}>
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
      <ChromeBar visible={hovered}>
        <OpenLink href={info.url} title="Open original image" />
        <CopyLink url={info.url} title="Copy image URL" />
      </ChromeBar>
    </div>
  )
}

// ----- Plain web URL ---------------------------------------------------------

function WebLink({ item, info, hovered }) {
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
      {/* Hover-only Copy URL chip. Only rendered when there's a real
          safe http(s) URL — unsafe URLs (which render the placeholder
          above) never expose a copy affordance. The big "Open →" CTA
          stays as the primary discovery affordance; this is the
          secondary "I want the URL itself" path. */}
      {safeUrl && (
        <ChromeBar visible={hovered}>
          <CopyLink url={safeUrl} title="Copy link URL" />
        </ChromeBar>
      )}
    </div>
  )
}

// ----- Shared embed chrome ---------------------------------------------------

// Slim 26-px drag strip at the top of an iframe card while in Interact
// mode. Plain <div> (not in BoardItem's react-rnd `cancel` selector) so
// mousedown bubbles up and starts a drag. zIndex 18 sits above the
// iframe but below the mini-toolbar (z:20) and corner resize handles
// (z:25) so the user can still hit those at their respective regions.
function DragStrip() {
  return (
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
  )
}

// Bottom-left chrome cluster used by every iframe-embed variant. Hidden
// until the card is hovered (or the user is in Interact, which is owned
// by the parent and threaded through `visible`). Marked .no-drag and
// stops mousedown so clicks here never start a drag, and zIndex 30
// keeps it above the iframe + drag strip + corner handles.
function ChromeBar({ visible, children }) {
  return (
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
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
        transition: 'opacity 0.15s',
      }}
    >
      {children}
    </div>
  )
}

function InteractToggle({ interact, setInteract }) {
  return interact ? (
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
  )
}

function OpenLink({ href, title }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={title}
      // .no-drag + stopPropagation prevent a card drag from starting
      // when the user clicks the link inside RemoteVideo's mini bar
      // (which is not wrapped in ChromeBar so it doesn't inherit those).
      className="no-drag"
      onMouseDown={(e) => e.stopPropagation()}
      style={{ ...ytBtn, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
    >
      ↗
    </a>
  )
}

// Hover-only "Copy URL" chip. Tries the modern Clipboard API first;
// falls back to a hidden-textarea + execCommand('copy') for non-secure
// contexts (file://, older Electron renderers); silently no-ops if both
// fail. Briefly flashes a ✓ on success so the user gets feedback
// without us pulling in a toast/snackbar dependency.
//
// `url` is always the already-validated safe http(s) URL produced by
// classifyLink — never the raw user input — so what lands on the
// clipboard matches what the embed actually loads.
function CopyLink({ url, title = 'Copy URL' }) {
  const [copied, setCopied] = useState(false)
  if (!url) return null
  return (
    <button
      type="button"
      title={copied ? 'Copied!' : title}
      aria-label={title}
      // .no-drag + stopPropagation so clicks here never start a drag,
      // even when this is rendered outside a ChromeBar (e.g. in
      // RemoteVideo's mini control row).
      className="no-drag"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={async () => {
        const ok = await copyToClipboard(url)
        if (ok) {
          setCopied(true)
          setTimeout(() => setCopied(false), 1200)
        }
      }}
      style={{
        ...ytBtn,
        background: copied
          ? 'rgba(var(--accent-rgb), 0.85)'
          : ytBtn.background,
      }}
    >
      {copied ? '✓' : '⧉'}
    </button>
  )
}

async function copyToClipboard(text) {
  // Modern path — only available in secure contexts (https / localhost).
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // fall through to execCommand fallback
  }
  // Legacy fallback for non-secure contexts (file://, older Electron
  // renderers without secure-context). Creates an off-screen textarea,
  // selects its contents, and triggers the deprecated-but-still-working
  // document.execCommand('copy'). Silently returns false if either step
  // throws — caller treats that as "do nothing", no error UI.
  try {
    if (typeof document === 'undefined') return false
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.top = '-1000px'
    ta.style.left = '0'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand && document.execCommand('copy')
    document.body.removeChild(ta)
    return !!ok
  } catch {
    return false
  }
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
