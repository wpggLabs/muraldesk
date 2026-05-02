import { useRef } from 'react'

export default function VideoCard({ item, onUpdate, hovered }) {
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
          pointerEvents: 'none', // let drag pass through the video
        }}
      />
      {/* Mute / loop controls — only visible on hover/select. zIndex above
          the corner resize handle (z:25) so the buttons always win clicks
          at the bottom-left. */}
      <div
        className="no-drag"
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          position: 'absolute',
          bottom: 8,
          left: 8,
          display: 'flex',
          gap: 4,
          zIndex: 30,
          opacity: hovered ? 1 : 0,
          pointerEvents: hovered ? 'auto' : 'none',
          transition: 'opacity 0.15s',
        }}
      >
        <button
          type="button"
          title={item.muted !== false ? 'Unmute' : 'Mute'}
          onClick={() => {
            const v = videoRef.current
            const next = v ? !v.muted : !(item.muted !== false)
            if (v) v.muted = next
            onUpdate(item.id, { muted: next })
          }}
          style={ctrlBtn}
        >
          {item.muted !== false ? '🔇' : '🔊'}
        </button>
        <button
          type="button"
          title={item.loop !== false ? 'Loop on' : 'Loop off'}
          onClick={() => onUpdate(item.id, { loop: !(item.loop !== false) })}
          style={{
            ...ctrlBtn,
            background: item.loop !== false ? 'rgba(108,99,255,0.75)' : ctrlBtn.background,
          }}
        >
          ↻
        </button>
      </div>
    </div>
  )
}

const ctrlBtn = {
  background: 'rgba(0,0,0,0.65)',
  color: '#fff',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 5,
  padding: '3px 7px',
  fontSize: 11,
  cursor: 'pointer',
}
