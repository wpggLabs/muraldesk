export default function EmptyState() {
  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      pointerEvents: 'none',
      userSelect: 'none',
    }}>
      <div style={{
        fontSize: 56,
        marginBottom: 16,
        opacity: 0.2,
      }}>
        🖼
      </div>
      <div style={{
        color: 'var(--text-muted)',
        fontSize: 18,
        fontWeight: 600,
        marginBottom: 8,
        opacity: 0.5,
      }}>
        Your board is empty
      </div>
      <div style={{
        color: 'var(--text-muted)',
        fontSize: 13,
        opacity: 0.35,
        textAlign: 'center',
        maxWidth: 280,
        lineHeight: 1.6,
      }}>
        Add images, videos, notes, or links using the toolbar above. Drag and resize anything on the board.
      </div>
    </div>
  )
}
