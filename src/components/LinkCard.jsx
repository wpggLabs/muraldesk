export default function LinkCard({ item }) {
  const rawUrl = item.url || ''
  let hostname = ''
  let safeUrl = ''
  try {
    const parsed = new URL(rawUrl)
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      hostname = parsed.hostname
      safeUrl = rawUrl
    }
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
      {safeUrl ? (
        <a
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
