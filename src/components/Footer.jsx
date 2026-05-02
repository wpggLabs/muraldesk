export default function Footer() {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 8,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 50,
        pointerEvents: 'none',
        userSelect: 'none',
        color: 'var(--text-muted)',
        fontSize: 11,
        letterSpacing: 0.4,
        opacity: 0.55,
        whiteSpace: 'nowrap',
      }}
    >
      MuralDesk · Local-first · No account · Offline storage
    </div>
  )
}
