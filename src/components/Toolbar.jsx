import { useEffect, useRef, useState } from 'react'

export default function Toolbar({
  onAddImage,
  onAddVideo,
  onAddNote,
  onAddLink,
  onClear,
  onSampleBoard,
  onExport,
  onImport,
  isFullscreen,
  onToggleFullscreen,
}) {
  const imageInputRef = useRef(null)
  const videoInputRef = useRef(null)
  const importInputRef = useRef(null)
  const [linkDialog, setLinkDialog] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [linkTitle, setLinkTitle] = useState('')
  const [linkDesc, setLinkDesc] = useState('')

  // Auto-dim toolbar when the mouse drifts away from the top of the
  // canvas, so the workspace feels like a clean mural rather than an app.
  // Toolbar stays fully visible while hovered, while a dialog is open,
  // or until the first mouse-move arrives.
  const [nearTop, setNearTop] = useState(true)
  const [hovered, setHovered] = useState(false)
  useEffect(() => {
    function onMove(e) {
      setNearTop(e.clientY < 110)
    }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [])
  const dim = !(nearTop || hovered || linkDialog)

  function handleImageFile(e) {
    const file = e.target.files[0]
    if (!file) return
    onAddImage(file)
    e.target.value = ''
  }

  function handleVideoFile(e) {
    const file = e.target.files[0]
    if (!file) return
    onAddVideo(file)
    e.target.value = ''
  }

  function handleImportFile(e) {
    const file = e.target.files[0]
    if (!file) return
    onImport && onImport(file)
    e.target.value = ''
  }

  function handleLinkSubmit(e) {
    e.preventDefault()
    if (!linkUrl.trim()) return
    let url = linkUrl.trim()
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url
    onAddLink(url, linkTitle.trim(), linkDesc.trim())
    setLinkUrl('')
    setLinkTitle('')
    setLinkDesc('')
    setLinkDialog(false)
  }

  return (
    <>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          position: 'fixed',
          top: 14,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          background: 'rgba(20,20,26,0.78)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 999,
          padding: '5px 8px',
          boxShadow: '0 10px 32px rgba(0,0,0,0.5)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          maxWidth: 'calc(100vw - 32px)',
          flexWrap: 'wrap',
          justifyContent: 'center',
          opacity: dim ? 0.32 : 1,
          transition: 'opacity 0.25s ease',
        }}
      >
        <span
          style={{
            color: 'var(--accent)',
            fontWeight: 700,
            fontSize: 12,
            padding: '0 8px',
            letterSpacing: 0.5,
          }}
        >
          MuralDesk
        </span>

        <PillBtn icon="🖼" label="Image" onClick={() => imageInputRef.current?.click()} />
        <PillBtn icon="🎬" label="Video" onClick={() => videoInputRef.current?.click()} />
        <PillBtn icon="📝" label="Note" onClick={onAddNote} />
        <PillBtn icon="🔗" label="Link" onClick={() => setLinkDialog(true)} />

        <Divider />

        <PillBtn icon="✨" label="Sample" onClick={onSampleBoard} />
        <PillBtn icon="↧" label="Export" onClick={onExport} />
        <PillBtn icon="↥" label="Import" onClick={() => importInputRef.current?.click()} />

        <Divider />

        <PillBtn
          icon={isFullscreen ? '⤡' : '⤢'}
          label={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          onClick={onToggleFullscreen}
        />

        <Divider />

        <PillBtn
          icon="🗑"
          label="Clear"
          onClick={() => { if (confirm('Clear all items from the board?')) onClear() }}
          danger
        />

        <input ref={imageInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageFile} />
        <input ref={videoInputRef} type="file" accept="video/*" style={{ display: 'none' }} onChange={handleVideoFile} />
        <input ref={importInputRef} type="file" accept="application/json,.json" style={{ display: 'none' }} onChange={handleImportFile} />
      </div>

      {linkDialog && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={() => setLinkDialog(false)}
        >
          <form
            onSubmit={handleLinkSubmit}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: 24,
              width: 360,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              boxShadow: 'var(--shadow)',
            }}
          >
            <div style={{ fontWeight: 600, fontSize: 15 }}>Add Link Card</div>
            <input
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="URL (e.g. https://example.com)"
              required
              autoFocus
              style={inputStyle}
            />
            <input
              value={linkTitle}
              onChange={(e) => setLinkTitle(e.target.value)}
              placeholder="Title (optional)"
              style={inputStyle}
            />
            <textarea
              value={linkDesc}
              onChange={(e) => setLinkDesc(e.target.value)}
              placeholder="Description (optional)"
              rows={2}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setLinkDialog(false)} style={cancelBtnStyle}>
                Cancel
              </button>
              <button type="submit" style={submitBtnStyle}>
                Add Card
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}

function Divider() {
  return (
    <div
      aria-hidden
      style={{
        width: 1,
        height: 18,
        background: 'rgba(255,255,255,0.08)',
        margin: '0 4px',
      }}
    />
  )
}

function PillBtn({ icon, label, onClick, danger }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      title={label}
      aria-label={label}
      style={{
        background: hov
          ? danger ? 'rgba(255,79,79,0.18)' : 'rgba(255,255,255,0.08)'
          : 'transparent',
        color: danger
          ? hov ? 'var(--danger)' : 'var(--text-muted)'
          : hov ? 'var(--text)' : 'var(--text-muted)',
        border: 'none',
        borderRadius: 999,
        padding: '4px 10px',
        fontSize: 13,
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        transition: 'all 0.12s',
        whiteSpace: 'nowrap',
        cursor: 'pointer',
      }}
    >
      <span style={{ fontSize: 13, lineHeight: 1 }}>{icon}</span>
      <span style={{ fontSize: 12 }}>{label}</span>
    </button>
  )
}

const inputStyle = {
  background: 'var(--surface2)',
  border: '1px solid var(--border)',
  borderRadius: 7,
  padding: '8px 10px',
  color: 'var(--text)',
  fontSize: 13,
  width: '100%',
}

const cancelBtnStyle = {
  background: 'var(--surface2)',
  color: 'var(--text-muted)',
  border: '1px solid var(--border)',
  borderRadius: 7,
  padding: '6px 16px',
  fontSize: 13,
  cursor: 'pointer',
}

const submitBtnStyle = {
  background: 'var(--accent)',
  color: '#fff',
  border: 'none',
  borderRadius: 7,
  padding: '6px 16px',
  fontSize: 13,
  cursor: 'pointer',
}
