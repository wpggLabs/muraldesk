export default function LinkCard({ item }) {
  const url = item.url || ''
  let hostname = ''
  try {
    hostname = new URL(url).hostname
  } catch {}

  const faviconUrl = hostname ? `https://www.google.com/s2/favicons?domain=${hostname}&sz=32` : null

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: '32px 14px 14px',
        background: 'var(--surface2)',
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        {faviconUrl && (
          <img
            src={faviconUrl}
            alt=""
            style={{ width: 16, height: 16, borderRadius: 3, flexShrink: 0 }}
          />
        )}
        <span style={{ color: 'var(--text-muted)', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
      <a
        href={url}
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
    </div>
  )
}
