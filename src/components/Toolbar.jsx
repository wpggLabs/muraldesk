import { useRef, useState } from 'react'

export default function Toolbar({ onAddImage, onAddVideo, onAddNote, onAddLink, onClear }) {
  const imageInputRef = useRef(null)
  const videoInputRef = useRef(null)
  const [linkDialog, setLinkDialog] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [linkTitle, setLinkTitle] = useState('')
  const [linkDesc, setLinkDesc] = useState('')

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
      <div style={{
        position: 'fixed',
        top: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: '6px 10px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        backdropFilter: 'blur(12px)',
      }}>
        <span style={{ color: 'var(--accent)', fontWeight: 700, fontSize: 13, marginRight: 8, letterSpacing: 0.5 }}>
          MuralDesk
        </span>

        <ToolBtn icon="🖼" label="Image" onClick={() => imageInputRef.current?.click()} />
        <ToolBtn icon="🎬" label="Video" onClick={() => videoInputRef.current?.click()} />
        <ToolBtn icon="📝" label="Note" onClick={onAddNote} />
        <ToolBtn icon="🔗" label="Link" onClick={() => setLinkDialog(true)} />

        <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 4px' }} />

        <ToolBtn icon="🗑" label="Clear" onClick={() => {
          if (confirm('Clear all items from the board?')) onClear()
        }} danger />

        <input ref={imageInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageFile} />
        <input ref={videoInputRef} type="file" accept="video/*" style={{ display: 'none' }} onChange={handleVideoFile} />
      </div>

      {linkDialog && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 99999,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }} onClick={() => setLinkDialog(false)}>
          <form
            onSubmit={handleLinkSubmit}
            onClick={e => e.stopPropagation()}
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
              onChange={e => setLinkUrl(e.target.value)}
              placeholder="URL (e.g. https://example.com)"
              required
              style={inputStyle}
            />
            <input
              value={linkTitle}
              onChange={e => setLinkTitle(e.target.value)}
              placeholder="Title (optional)"
              style={inputStyle}
            />
            <textarea
              value={linkDesc}
              onChange={e => setLinkDesc(e.target.value)}
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

function ToolBtn({ icon, label, onClick, danger }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      title={label}
      style={{
        background: hov ? (danger ? 'rgba(255,79,79,0.15)' : 'var(--surface2)') : 'transparent',
        color: danger ? (hov ? 'var(--danger)' : 'var(--text-muted)') : hov ? 'var(--text)' : 'var(--text-muted)',
        border: '1px solid transparent',
        borderRadius: 8,
        padding: '4px 8px',
        fontSize: 13,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        transition: 'all 0.15s',
        whiteSpace: 'nowrap',
      }}
    >
      <span>{icon}</span>
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
