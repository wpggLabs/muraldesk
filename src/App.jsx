import { useCallback, useEffect, useRef, useState } from 'react'
import { useBoard } from './hooks/useBoard'
import { useDesktopMode } from './hooks/useDesktopMode'
import { useElectronClickThrough } from './hooks/useElectronClickThrough'
import { buildSampleItems } from './lib/sampleBoard'
import { defaultLinkSize } from './lib/linkType'
import BoardItem from './components/BoardItem'
import Toolbar from './components/Toolbar'
import EmptyState from './components/EmptyState'

export default function App() {
  const {
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
  } = useBoard()

  const [selectedId, setSelectedId] = useState(null)

  // Imperative ref into Toolbar so the keyboard shortcuts
  // (Ctrl+Shift+I / V / L) can open the file pickers and link dialog
  // without lifting the Toolbar's internal refs and dialog state out
  // of that component. Toolbar exposes this surface via
  // useImperativeHandle.
  const toolbarRef = useRef(null)

  // Toolbar visibility override driven by Ctrl+Shift+T (Electron only).
  //   null   → auto (existing reveal-zone / hover / dialog logic)
  //   'show' → pinned visible
  //   'hide' → pinned hidden
  // Cycles null → 'show' → 'hide' → null. Lives in App rather than
  // Toolbar so the cycle is observable from the keydown handler and
  // so the override survives Toolbar re-mounts.
  const [manualToolbarOverride, setManualToolbarOverride] = useState(null)

  // Desktop Canvas Mode + unified fullscreen control. On web this hook
  // wraps the document Fullscreen API; in Electron it talks to the main
  // process via the preload bridge so the OS-level window goes fullscreen
  // and the toolbar can auto-hide for a desktop-mural feel.
  const {
    isElectron,
    isFullscreen,
    toggleFullscreen,
    desktopMode,
    setDesktopMode,
    toggleDesktopMode,
  } = useDesktopMode()

  // Mark <html data-electron="true"> so src/index.css can paint the
  // root transparent in the Electron build. The web/PWA build never
  // sets this attribute and keeps its dark canvas background.
  useEffect(() => {
    if (!isElectron) return
    document.documentElement.setAttribute('data-electron', 'true')
    return () => document.documentElement.removeAttribute('data-electron')
  }, [isElectron])

  // Click-through for transparent areas (Electron only). When the
  // cursor is over the toolbar, a pinned item, or a dialog, MuralDesk
  // captures clicks; everywhere else clicks pass through to the
  // user's desktop. No-op on the web build.
  useElectronClickThrough(isElectron)

  // Track which items are currently hovered. Used in Electron mode so
  // the floating toolbar can reveal itself whenever the user is
  // pointing at any pinned item (per the transparent-overlay spec).
  const [hoveredIds, setHoveredIds] = useState(() => new Set())
  const handleItemHoverChange = useCallback((id, isHovered) => {
    setHoveredIds((prev) => {
      const next = new Set(prev)
      if (isHovered) next.add(id); else next.delete(id)
      return next
    })
  }, [])
  // Prune ids that no longer exist (e.g. an item was removed while
  // hovered, so its mouseleave never fired). Otherwise the toolbar
  // could stay revealed forever.
  useEffect(() => {
    setHoveredIds((prev) => {
      if (prev.size === 0) return prev
      const valid = new Set(items.map((it) => it.id))
      let changed = false
      const next = new Set()
      for (const id of prev) {
        if (valid.has(id)) next.add(id)
        else changed = true
      }
      return changed ? next : prev
    })
  }, [items])
  const anyItemHovered = hoveredIds.size > 0

  // Frameless-window controls (Electron only). On the web these are
  // unused; the bridge is undefined.
  const handleMinimize = useCallback(() => {
    window.muraldesk?.minimizeWindow?.()
  }, [])
  const handleClose = useCallback(() => {
    window.muraldesk?.closeWindow?.()
  }, [])

  // Pick a spawn position for new items. In Desktop Canvas Mode the
  // BrowserWindow covers the full display, so the default jitter
  // position (80 + random*200, top-left of the viewport) lands cards
  // way off in a corner and can clip behind the taskbar / dock. We
  // center on the viewport instead, with a small random jitter so
  // consecutive adds don't perfectly overlap. Outside Desktop Mode
  // we return an empty object so useBoard's existing top-left jitter
  // is preserved (it's appropriate for the small normal window).
  const spawnPosFor = useCallback((width, height, opts = {}) => {
    // `opts.center: true` forces center placement even outside Desktop
    // Mode — used by the Ctrl+Shift+N "Add note near center" shortcut
    // so a keyboard-spawned note lands predictably regardless of
    // whether the user is in normal-window mode or Desktop Canvas Mode.
    const wantCenter = desktopMode || !!opts.center
    if (!wantCenter) return {}
    if (typeof window === 'undefined') return {}
    const cx = (window.innerWidth - width) / 2
    const cy = (window.innerHeight - height) / 2
    const jx = (Math.random() - 0.5) * 80
    const jy = (Math.random() - 0.5) * 60
    // Clamp so even with jitter we never spawn at a negative coord
    // (which would put the card's drag handle off-screen).
    return {
      x: Math.max(20, Math.round(cx + jx)),
      y: Math.max(20, Math.round(cy + jy)),
    }
  }, [desktopMode])

  const handleAddImage = useCallback((file) => {
    const w = 300
    const h = 220
    addMediaItem('image', file, { width: w, height: h, ...spawnPosFor(w, h) })
  }, [addMediaItem, spawnPosFor])

  const handleAddVideo = useCallback((file) => {
    const w = 360
    const h = 240
    addMediaItem('video', file, {
      width: w, height: h, loop: true, muted: true, ...spawnPosFor(w, h),
    })
  }, [addMediaItem, spawnPosFor])

  const handleAddNote = useCallback(() => {
    const w = 220
    const h = 180
    addItem('note', {
      text: '', width: w, height: h, color: '#2a2a3a', ...spawnPosFor(w, h),
    })
  }, [addItem, spawnPosFor])

  // Variant of handleAddNote used by the Ctrl+Shift+N keyboard shortcut.
  // Always centers via `{ center: true }`, even outside Desktop Mode,
  // so a keyboard-spawned note lands in a predictable place no matter
  // what mode the user is in. The toolbar's "+ Note" button keeps
  // using the mode-aware handleAddNote so the existing UX is unchanged.
  const handleAddNoteCentered = useCallback(() => {
    const w = 220
    const h = 180
    addItem('note', {
      text: '', width: w, height: h, color: '#2a2a3a',
      ...spawnPosFor(w, h, { center: true }),
    })
  }, [addItem, spawnPosFor])

  const handleAddLink = useCallback((url, title, description) => {
    // Pick a default size that fits the link's preview kind: 16:9-ish for
    // YouTube / direct video, taller for images, compact for plain web.
    const { width, height } = defaultLinkSize(url)
    addItem('link', { url, title, description, width, height, ...spawnPosFor(width, height) })
  }, [addItem, spawnPosFor])

  const handleSampleBoard = useCallback(() => {
    // In Electron Desktop Mode the rich onboarding sample (with two
    // Welcome / Tips note panels) feels too "app-like" for what is
    // meant to be a clean desktop mural layer — minimal mode returns
    // just one image, one link, and a small sticky note centered on
    // the current display. Web/PWA and normal-window Electron keep
    // the richer sample.
    addItems(buildSampleItems({ minimal: desktopMode }))
  }, [addItems, desktopMode])

  const handleExport = useCallback(() => {
    const data = exportLayout()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    a.download = `muraldesk-layout-${stamp}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }, [exportLayout])

  const handleImport = useCallback((file) => {
    const MAX_IMPORT_BYTES = 5 * 1024 * 1024 // 5 MB
    const MAX_IMPORT_ITEMS = 500
    if (file.size > MAX_IMPORT_BYTES) {
      alert('Layout file is too large (5 MB max).')
      return
    }
    const reader = new FileReader()
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(reader.result)
        let incoming = Array.isArray(parsed) ? parsed : parsed?.items
        if (!Array.isArray(incoming)) {
          alert('That file does not look like a MuralDesk layout.')
          return
        }
        if (incoming.length > MAX_IMPORT_ITEMS) {
          alert(`Layout has too many items (${incoming.length}). Max is ${MAX_IMPORT_ITEMS}.`)
          return
        }
        // Sanitize: drop unsafe protocols on link items so an imported
        // javascript:/data: URL can never become a clickable href.
        incoming = incoming.map((it) => {
          if (it && it.type === 'link' && typeof it.url === 'string') {
            try {
              const proto = new URL(it.url).protocol
              if (proto !== 'http:' && proto !== 'https:') {
                return { ...it, url: '' }
              }
            } catch {
              return { ...it, url: '' }
            }
          }
          return it
        })
        const ok = items.length === 0
          ? true
          : confirm(`Replace your current board with ${incoming.length} imported item(s)?`)
        if (!ok) return
        await importLayout(incoming)
        setSelectedId(null)
      } catch (err) {
        console.error(err)
        alert('Could not read that layout file.')
      }
    }
    reader.readAsText(file)
  }, [items.length, importLayout])

  // Keyboard shortcuts:
  //   Always-on (work even while typing in a note):
  //     - Ctrl/Cmd + Shift + F → toggle fullscreen (Electron Desktop
  //                              Mode overlay, or web Fullscreen API)
  //   Electron-only always-on (the same chords clash with browser
  //   shortcuts on web — Ctrl+Shift+T = Reopen closed tab, +N = New
  //   incognito, +I = DevTools, +D = Bookmark all tabs, etc — so we
  //   gate them to the Electron build to avoid advertising broken
  //   behavior in a normal browser tab):
  //     - Ctrl/Cmd + Shift + D → toggle Desktop Mode
  //     - Ctrl/Cmd + Shift + T → cycle toolbar override
  //                              (auto → show → hide → auto). Lets the
  //                              user surface the toolbar without
  //                              moving the mouse when MuralDesk is
  //                              a click-through transparent overlay.
  //     - Ctrl/Cmd + Shift + N → add a note near the center of the
  //                              viewport (independent of Desktop Mode)
  //     - Ctrl/Cmd + Shift + I → open the image file picker
  //     - Ctrl/Cmd + Shift + V → open the video file picker
  //     - Ctrl/Cmd + Shift + L → open the Add-Link dialog
  //   Editable-gated (skip while typing in an input / textarea so
  //   note editing keeps working):
  //     - Escape → exit Desktop Mode if active, then deselect
  //     - Delete / Backspace → remove the selected card
  useEffect(() => {
    function isEditableTarget(t) {
      if (!t) return false
      const tag = (t.tagName || '').toLowerCase()
      return tag === 'input' || tag === 'textarea' || t.isContentEditable
    }
    function onKey(e) {
      // Ctrl/Cmd + Shift + <letter> chord block. preventDefault is
      // called per-handler so the OS / browser shortcut never also
      // fires (e.g. Ctrl+Shift+I would otherwise open Electron's
      // DevTools in a dev build).
      if (e.shiftKey && (e.ctrlKey || e.metaKey)) {
        const k = (e.key || '').toLowerCase()
        if (k === 'f') {
          e.preventDefault()
          toggleFullscreen()
          return
        }
        if (isElectron) {
          if (k === 'd') {
            e.preventDefault()
            toggleDesktopMode()
            return
          }
          if (k === 't') {
            e.preventDefault()
            // Tri-state cycle: null → 'show' → 'hide' → null.
            setManualToolbarOverride((prev) =>
              prev === null ? 'show' : prev === 'show' ? 'hide' : null,
            )
            return
          }
          if (k === 'n') {
            e.preventDefault()
            handleAddNoteCentered()
            return
          }
          if (k === 'i') {
            e.preventDefault()
            toolbarRef.current?.openImagePicker?.()
            return
          }
          if (k === 'v') {
            e.preventDefault()
            toolbarRef.current?.openVideoPicker?.()
            return
          }
          if (k === 'l') {
            e.preventDefault()
            toolbarRef.current?.openLinkDialog?.()
            return
          }
        }
      }
      if (isEditableTarget(e.target)) return
      if (e.key === 'Escape') {
        if (desktopMode) setDesktopMode(false)
        setSelectedId(null)
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        e.preventDefault()
        removeItem(selectedId)
        setSelectedId(null)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [
    selectedId, removeItem, desktopMode, setDesktopMode, toggleFullscreen,
    isElectron, toggleDesktopMode, handleAddNoteCentered,
  ])

  // Click on empty canvas deselects.
  function handleCanvasMouseDown(e) {
    if (e.target === e.currentTarget) setSelectedId(null)
  }

  // In Electron transparent-overlay mode we paint NOTHING on the canvas
  // background — no bg color, no ambient gradients, no grid, no empty-
  // state hero. Only pinned items and the floating toolbar are visible
  // on top of the user's desktop. The web/PWA build keeps the original
  // dark canvas with its decorative layers and onboarding hero.
  return (
    <div
      onMouseDown={handleCanvasMouseDown}
      style={{
        width: '100vw',
        height: '100vh',
        position: 'relative',
        overflow: 'hidden',
        background: isElectron ? 'transparent' : 'var(--bg)',
      }}
    >
      {!isElectron && (
        <>
          {/* Soft ambient glow + grid (purely decorative, never intercepts pointer) */}
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: `
                radial-gradient(circle at 20% 30%, rgba(108,99,255,0.04) 0%, transparent 60%),
                radial-gradient(circle at 80% 70%, rgba(62,207,142,0.03) 0%, transparent 60%)
              `,
              pointerEvents: 'none',
            }}
          />
          <div
            aria-hidden
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
        </>
      )}

      {items.length === 0 && !isElectron && (
        <EmptyState
          onSampleBoard={handleSampleBoard}
          onAddNote={handleAddNote}
        />
      )}

      {/*
        Items render directly into the root canvas so react-rnd's bounds="parent"
        is the full viewport. No wrapper container = no reduced draggable area.
        We forward mouse-down on empty canvas via the root element above.
      */}
      {items.map((item) => (
        <BoardItem
          key={item.id}
          item={item}
          selected={selectedId === item.id}
          onUpdate={updateItem}
          onRemove={(id) => {
            removeItem(id)
            if (selectedId === id) setSelectedId(null)
          }}
          onFocus={bringToFront}
          onSelect={setSelectedId}
          onDuplicate={duplicateItem}
          onHoverChange={handleItemHoverChange}
        />
      ))}

      <Toolbar
        ref={toolbarRef}
        onAddImage={handleAddImage}
        onAddVideo={handleAddVideo}
        onAddNote={handleAddNote}
        onAddLink={handleAddLink}
        onClear={() => { clearBoard(); setSelectedId(null) }}
        onSampleBoard={handleSampleBoard}
        onExport={handleExport}
        onImport={handleImport}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
        isElectron={isElectron}
        desktopMode={desktopMode}
        onToggleDesktopMode={toggleDesktopMode}
        hasItems={items.length > 0}
        anyItemHovered={anyItemHovered}
        onMinimizeWindow={handleMinimize}
        onCloseWindow={handleClose}
        manualOverride={manualToolbarOverride}
      />
    </div>
  )
}
