import { useState, useEffect, useCallback } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { saveBlob, getBlob, deleteBlob, clearAllBlobs } from '../lib/mediaStore'

const STORAGE_KEY = 'muraldesk-board'

function loadBoard() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveBoard(items) {
  try {
    const persisted = items.map((item) => {
      if (item.mediaId) {
        const { src, ...rest } = item
        return rest
      }
      return item
    })
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted))
  } catch {}
}

function revokeIfBlob(url) {
  if (url && typeof url === 'string' && url.startsWith('blob:')) {
    try { URL.revokeObjectURL(url) } catch {}
  }
}

export function useBoard() {
  const [items, setItems] = useState(loadBoard)

  // Hydrate media srcs from IndexedDB. Cancellable so StrictMode's
  // double-mount in dev doesn't leak object URLs.
  useEffect(() => {
    let cancelled = false
    const created = []
    ;(async () => {
      const updates = {}
      const snapshot = items
      for (const item of snapshot) {
        if (item.mediaId && !item.src) {
          try {
            const blob = await getBlob(item.mediaId)
            if (cancelled) return
            if (blob) {
              const url = URL.createObjectURL(blob)
              updates[item.id] = url
              created.push(url)
            }
          } catch {}
        }
      }
      if (cancelled) return
      if (Object.keys(updates).length) {
        setItems((prev) =>
          prev.map((it) => (updates[it.id] ? { ...it, src: updates[it.id] } : it))
        )
      }
    })()
    return () => {
      cancelled = true
      // If we got cancelled mid-flight or before commit, revoke the URLs
      // we created. Once committed to state, removeItem/clearBoard handle revoke.
      created.forEach(revokeIfBlob)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    saveBoard(items)
  }, [items])

  const addItem = useCallback((type, data = {}) => {
    const item = {
      id: uuidv4(),
      type,
      x: 80 + Math.random() * 200,
      y: 80 + Math.random() * 200,
      width: data.width || 280,
      height: data.height || 200,
      zIndex: Date.now(),
      ...data,
    }
    setItems((prev) => [...prev, item])
    return item
  }, [])

  const addMediaItem = useCallback(async (type, file, extra = {}) => {
    const id = uuidv4()
    let persisted = false
    try {
      await saveBlob(id, file)
      persisted = true
    } catch (err) {
      console.error('Could not save media to IndexedDB; item will be session-only.', err)
    }
    const src = URL.createObjectURL(file)
    const item = {
      id,
      type,
      src,
      label: file.name,
      x: 80 + Math.random() * 200,
      y: 80 + Math.random() * 200,
      width: extra.width || 280,
      height: extra.height || 200,
      zIndex: Date.now(),
      ...extra,
      // Only mark as persistable if the blob actually made it into IDB.
      ...(persisted ? { mediaId: id } : {}),
    }
    setItems((prev) => [...prev, item])
    return item
  }, [])

  const updateItem = useCallback((id, changes) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...changes } : item))
    )
  }, [])

  const removeItem = useCallback((id) => {
    setItems((prev) => {
      const target = prev.find((x) => x.id === id)
      if (target) {
        revokeIfBlob(target.src)
        if (target.mediaId) deleteBlob(target.mediaId).catch(() => {})
      }
      return prev.filter((item) => item.id !== id)
    })
  }, [])

  const bringToFront = useCallback((id) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, zIndex: Date.now() } : item))
    )
  }, [])

  const clearBoard = useCallback(() => {
    setItems((prev) => {
      prev.forEach((it) => revokeIfBlob(it.src))
      return []
    })
    clearAllBlobs().catch(() => {})
  }, [])

  return {
    items,
    addItem,
    addMediaItem,
    updateItem,
    removeItem,
    bringToFront,
    clearBoard,
  }
}
