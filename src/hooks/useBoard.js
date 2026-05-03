import { useState, useEffect, useCallback, useRef } from 'react'
import { saveBlob, getBlob, deleteBlob, clearAllBlobs } from '../lib/mediaStore'

const createId = () =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now()}-${Math.random().toString(36).slice(2)}`

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

async function hydrateMediaSrcs(itemList) {
  const updates = {}
  for (const item of itemList) {
    if (item.mediaId && !item.src) {
      try {
        const blob = await getBlob(item.mediaId)
        if (blob) updates[item.id] = URL.createObjectURL(blob)
      } catch {}
    }
  }
  return updates
}

export function useBoard() {
  const [items, setItems] = useState(loadBoard)
  // Token bumped on every importLayout so a slow hydrate from an older import
  // can't patch stale src into newer state.
  const importTokenRef = useRef(0)

  // Hydrate media srcs from IndexedDB on mount. Cancellable so React 18
  // StrictMode's double-mount in dev doesn't leak object URLs.
  useEffect(() => {
    let cancelled = false
    const created = []
    ;(async () => {
      const updates = await hydrateMediaSrcs(items)
      if (cancelled) {
        Object.values(updates).forEach(revokeIfBlob)
        return
      }
      Object.values(updates).forEach((u) => created.push(u))
      if (Object.keys(updates).length) {
        setItems((prev) =>
          prev.map((it) => (updates[it.id] ? { ...it, src: updates[it.id] } : it))
        )
      }
    })()
    return () => {
      cancelled = true
      created.forEach(revokeIfBlob)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    saveBoard(items)
  }, [items])

  const addItem = useCallback((type, data = {}) => {
    const item = {
      id: createId(),
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

  const addItems = useCallback((newItems) => {
    setItems((prev) => [...prev, ...newItems])
  }, [])

  const addMediaItem = useCallback(async (type, file, extra = {}) => {
    const id = createId()
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

  // Duplicate any item. For media-backed items we copy the blob in IDB to a
  // fresh id so the duplicate is independent of the original.
  const duplicateItem = useCallback(async (id) => {
    const original = items.find((x) => x.id === id)
    if (!original) return
    const newId = createId()
    let newMediaId
    let newSrc
    if (original.mediaId) {
      try {
        const blob = await getBlob(original.mediaId)
        if (blob) {
          await saveBlob(newId, blob)
          try {
            newSrc = URL.createObjectURL(blob)
            newMediaId = newId
          } catch (urlErr) {
            // Roll back IDB save so we don't leave an orphaned blob.
            await deleteBlob(newId).catch(() => {})
            throw urlErr
          }
        }
      } catch (err) {
        console.error('Could not duplicate media blob.', err)
      }
    }
    const copy = {
      ...original,
      id: newId,
      x: (original.x || 0) + 24,
      y: (original.y || 0) + 24,
      zIndex: Date.now(),
    }
    if (newMediaId) {
      copy.mediaId = newMediaId
      copy.src = newSrc
    } else if (original.mediaId) {
      // Couldn't copy media — strip media references so we don't reference a
      // non-existent or shared blob.
      delete copy.mediaId
      delete copy.src
    }
    setItems((prev) => [...prev, copy])
    return copy
  }, [items])

  // Layout JSON export. Strips transient blob: URLs (same shape as localStorage).
  const exportLayout = useCallback(() => {
    const persisted = items.map((item) => {
      if (item.mediaId) {
        const { src, ...rest } = item
        return rest
      }
      return item
    })
    return {
      version: 1,
      app: 'muraldesk',
      exportedAt: new Date().toISOString(),
      items: persisted,
    }
  }, [items])

  // Replace the current layout with imported items. Cleans IndexedDB blobs
  // that the new layout no longer references (mirrors removeItem semantics
  // for the items being dropped). Re-hydrates media from IDB for items the
  // new layout still references. Cancellable via importTokenRef so a slow
  // hydrate from an older import can't patch stale state.
  const importLayout = useCallback(async (newItems) => {
    if (!Array.isArray(newItems)) throw new Error('Invalid layout: items is not an array')
    const token = ++importTokenRef.current

    const newMediaIds = new Set(
      newItems.map((it) => it && it.mediaId).filter(Boolean)
    )
    const orphanIds = items
      .filter((it) => it.mediaId && !newMediaIds.has(it.mediaId))
      .map((it) => it.mediaId)

    items.forEach((it) => revokeIfBlob(it.src))

    await Promise.all(orphanIds.map((id) => deleteBlob(id).catch(() => {})))

    setItems(newItems.map((it) => ({ ...it, zIndex: it.zIndex || Date.now() })))

    const updates = await hydrateMediaSrcs(newItems)
    if (token !== importTokenRef.current) {
      Object.values(updates).forEach(revokeIfBlob)
      return
    }
    if (Object.keys(updates).length) {
      setItems((prev) =>
        prev.map((it) => (updates[it.id] ? { ...it, src: updates[it.id] } : it))
      )
    }
  }, [items])

  return {
    items,
    addItem,
    addItems,
    addMediaItem,
    updateItem,
    removeItem,
    bringToFront,
    clearBoard,
    duplicateItem,
    exportLayout,
    importLayout,
  }
}
