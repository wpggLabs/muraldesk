import { useEffect } from 'react'

// Keyboard-shortcuts help modal.
//
// Lists ONLY shortcuts that are actually wired up in the current build:
//   - Universal (web + Electron):
//       Esc                          → Deselect / exit Desktop Mode / close dialog
//       Delete or Backspace          → Remove the selected card
//       Ctrl/Cmd + Shift + F         → Toggle browser fullscreen
//       ?                            → Show this help
//   - Desktop app only (Electron):
//       Ctrl/Cmd + Shift + D         → Toggle Desktop Canvas Mode
//       Ctrl/Cmd + Shift + T         → Cycle toolbar (auto / show / hide)
//       Ctrl/Cmd + Shift + N         → Add a note near the center
//       Ctrl/Cmd + Shift + I         → Add an image (file picker)
//       Ctrl/Cmd + Shift + V         → Add a video (file picker)
//       Ctrl/Cmd + Shift + L         → Add a link
//
// Source of truth: the keydown handler in `src/App.jsx` (the
// `Ctrl/Cmd + Shift + <letter>` chord block plus the editable-gated
// Esc / Delete / Backspace fall-through).
//
// Visual contract: matches the existing Add-Link dialog (same
// backdrop blur, same surface tokens, same `muraldesk-overlay-in` /
// `muraldesk-dialog-in` animations). The backdrop carries
// `data-muraldesk-interactive="true"` so the Electron transparent-
// overlay click-through logic treats the modal as fully interactive
// and does NOT punch clicks through to the desktop underneath. The
// modal is rendered above the toolbar (z-index 99999, same as the
// Add-Link dialog) so it always wins clicks even while the toolbar
// is force-shown.
//
// Esc closes — the listener uses capture phase + stopPropagation so
// App's global Esc (deselect / exit Desktop Mode) does not also fire
// while the modal is open.
export default function ShortcutsModal({ open, onClose, isElectron = false }) {
  useEffect(() => {
    if (!open) return
    function onKey(e) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      data-muraldesk-interactive="true"
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'muraldesk-overlay-in 200ms var(--ease-out) both',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border-strong)',
          borderRadius: 'var(--radius-lg)',
          padding: 22,
          width: 420,
          maxWidth: '90vw',
          maxHeight: '85vh',
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          boxShadow: 'var(--shadow-lg)',
          animation: 'muraldesk-dialog-in 220ms var(--ease-out) both',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15, letterSpacing: -0.1, marginBottom: 4 }}>
              Keyboard shortcuts
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
              {isElectron
                ? 'Press ? at any time. Esc closes.'
                : 'Press ? at any time. Esc closes. More shortcuts in the desktop app.'}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'transparent',
              border: '1px solid var(--border)',
              color: 'var(--text-muted)',
              borderRadius: 'var(--radius-sm)',
              width: 28,
              height: 28,
              fontSize: 14,
              lineHeight: 1,
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>

        <Section title="Universal">
          <Row keys={['Esc']} desc="Deselect / exit Desktop Mode / close dialog" />
          <Row keys={['Delete']} alt={['Backspace']} desc="Remove the selected card" />
          <Row keys={[modKey(), 'Shift', 'F']} desc="Toggle browser fullscreen" />
          <Row keys={['?']} desc="Show this help" />
        </Section>

        {isElectron && (
          <Section title="Desktop app">
            <Row keys={[modKey(), 'Shift', 'D']} desc="Toggle Desktop Canvas Mode" />
            <Row keys={[modKey(), 'Shift', 'T']} desc="Cycle toolbar (auto / show / hide)" />
            <Row keys={[modKey(), 'Shift', 'N']} desc="Add a note near the center" />
            <Row keys={[modKey(), 'Shift', 'I']} desc="Add an image (file picker)" />
            <Row keys={[modKey(), 'Shift', 'V']} desc="Add a video (file picker)" />
            <Row keys={[modKey(), 'Shift', 'L']} desc="Add a link" />
          </Section>
        )}

        {!isElectron && (
          <div
            style={{
              fontSize: 11.5,
              color: 'var(--text-muted)',
              lineHeight: 1.5,
              padding: '8px 10px',
              border: '1px dashed var(--border)',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            The desktop build adds shortcuts for Desktop Canvas Mode, the
            toolbar override, and quick-add for notes, images, videos, and
            links — all using <Mono>Ctrl/Cmd&nbsp;+&nbsp;Shift&nbsp;+&nbsp;letter</Mono>.
          </div>
        )}
      </div>
    </div>
  )
}

// On macOS the modifier renders as ⌘; everywhere else as Ctrl. We
// detect via navigator.platform rather than userAgentData so this
// keeps working in Electron's Chromium without extra plumbing.
function modKey() {
  if (typeof navigator === 'undefined') return 'Ctrl'
  const p = (navigator.platform || '').toLowerCase()
  return p.includes('mac') ? '⌘' : 'Ctrl'
}

function Section({ title, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div
        style={{
          fontSize: 10.5,
          fontWeight: 600,
          letterSpacing: 0.6,
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
          marginBottom: 2,
        }}
      >
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {children}
      </div>
    </div>
  )
}

function Row({ keys, alt, desc }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '6px 8px',
        borderRadius: 'var(--radius-sm)',
        background: 'var(--surface2)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, minWidth: 132 }}>
        {keys.map((k, i) => (
          <Kbd key={`k-${i}`}>{k}</Kbd>
        ))}
        {alt && (
          <>
            <span style={{ color: 'var(--text-muted)', fontSize: 11, margin: '0 2px' }}>or</span>
            {alt.map((k, i) => (
              <Kbd key={`a-${i}`}>{k}</Kbd>
            ))}
          </>
        )}
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--text)', lineHeight: 1.35 }}>{desc}</div>
    </div>
  )
}

function Kbd({ children }) {
  return (
    <kbd
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border-strong)',
        borderBottomWidth: 2,
        borderRadius: 4,
        padding: '1px 6px',
        fontSize: 11,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        color: 'var(--text)',
        lineHeight: 1.4,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </kbd>
  )
}

function Mono({ children }) {
  return (
    <span
      style={{
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        fontSize: 11,
        color: 'var(--text)',
      }}
    >
      {children}
    </span>
  )
}
