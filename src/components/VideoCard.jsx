import { useRef } from 'react'

export default function VideoCard({ item, onUpdate }) {
  const videoRef = useRef(null)

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#000' }}>
      <video
        ref={videoRef}
        src={item.src}
        autoPlay
        loop={item.loop !== false}
        muted={item.muted !== false}
        playsInline
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: 6,
          right: 8,
          display: 'flex',
          gap: 4,
        }}
      >
        <button
          onClick={() => {
            const v = videoRef.current
            if (!v) return
            v.muted ? v.muted = false : v.muted = true
            onUpdate(item.id, { muted: v.muted })
          }}
          style={{
            background: 'rgba(0,0,0,0.6)',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            padding: '2px 6px',
            fontSize: 11,
          }}
        >
          {item.muted !== false ? '🔇' : '🔊'}
        </button>
        <button
          onClick={() => onUpdate(item.id, { loop: !item.loop })}
          style={{
            background: item.loop !== false ? 'rgba(108,99,255,0.7)' : 'rgba(0,0,0,0.6)',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            padding: '2px 6px',
            fontSize: 11,
          }}
        >
          ↻
        </button>
      </div>
    </div>
  )
}
