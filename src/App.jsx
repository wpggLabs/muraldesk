import { useCallback } from 'react'
import { useBoard } from './hooks/useBoard'
import BoardItem from './components/BoardItem'
import Toolbar from './components/Toolbar'
import EmptyState from './components/EmptyState'

export default function App() {
  const { items, addItem, addMediaItem, updateItem, removeItem, bringToFront, clearBoard } = useBoard()

  const handleAddImage = useCallback((file) => {
    addMediaItem('image', file, { width: 300, height: 220 })
  }, [addMediaItem])

  const handleAddVideo = useCallback((file) => {
    addMediaItem('video', file, { width: 360, height: 240, loop: true, muted: true })
  }, [addMediaItem])

  const handleAddNote = useCallback(() => {
    addItem('note', { text: '', width: 220, height: 180, color: '#2a2a3a' })
  }, [addItem])

  const handleAddLink = useCallback((url, title, description) => {
    addItem('link', { url, title, description, width: 280, height: 180 })
  }, [addItem])

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      position: 'relative',
      overflow: 'hidden',
      background: 'var(--bg)',
    }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            radial-gradient(circle at 20% 30%, rgba(108,99,255,0.04) 0%, transparent 60%),
            radial-gradient(circle at 80% 70%, rgba(62,207,142,0.03) 0%, transparent 60%)
          `,
          backgroundSize: '100% 100%',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
          pointerEvents: 'none',
        }}
      />

      {items.length === 0 && <EmptyState />}

      <div style={{ position: 'absolute', inset: 0 }}>
        {items.map(item => (
          <BoardItem
            key={item.id}
            item={item}
            onUpdate={updateItem}
            onRemove={removeItem}
            onFocus={bringToFront}
          />
        ))}
      </div>

      <Toolbar
        onAddImage={handleAddImage}
        onAddVideo={handleAddVideo}
        onAddNote={handleAddNote}
        onAddLink={handleAddLink}
        onClear={clearBoard}
      />
    </div>
  )
}
