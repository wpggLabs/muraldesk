export default function ImageCard({ item }) {
  // Per-item fit mode (see BoardItem mini-toolbar). 'cover' (default for
  // legacy items missing the field) crops the image to fully fill the
  // card. 'contain' letterboxes the image inside the card so the full
  // image is always visible. Letterbox bands are transparent — on a
  // mural background that means the desktop / canvas color shows
  // through, which is the intended mural aesthetic; we deliberately do
  // NOT paint a black background here (that would feel app-like).
  const fit = item.fit === 'contain' ? 'contain' : 'cover'
  return (
    <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
      <img
        src={item.src}
        alt={item.label || 'image'}
        style={{
          width: '100%',
          height: '100%',
          objectFit: fit,
          display: 'block',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
        draggable={false}
      />
    </div>
  )
}
