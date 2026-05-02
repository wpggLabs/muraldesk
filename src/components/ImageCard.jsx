export default function ImageCard({ item }) {
  return (
    <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
      <img
        src={item.src}
        alt={item.label || 'image'}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
        draggable={false}
      />
    </div>
  )
}
