import { useState, useEffect, useCallback } from 'react'
import { v4 as uuidv4 } from 'uuid'

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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch {}
}

export function useBoard() {
  const [items, setItems] = useState(loadBoard)

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
    setItems(prev => [...prev, item])
    return item
  }, [])

  const updateItem = useCallback((id, changes) => {
    setItems(prev =>
      prev.map(item => (item.id === id ? { ...item, ...changes } : item))
    )
  }, [])

  const removeItem = useCallback((id) => {
    setItems(prev => prev.filter(item => item.id !== id))
  }, [])

  const bringToFront = useCallback((id) => {
    setItems(prev =>
      prev.map(item =>
        item.id === id ? { ...item, zIndex: Date.now() } : item
      )
    )
  }, [])

  const clearBoard = useCallback(() => {
    setItems([])
  }, [])

  return { items, addItem, updateItem, removeItem, bringToFront, clearBoard }
}
