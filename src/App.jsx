import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useBoard } from './hooks/useBoard'
import { useBoardView } from './hooks/useBoardView'
import { useDesktopMode } from './hooks/useDesktopMode'
import { useElectronClickThrough } from './hooks/useElectronClickThrough'
import { useSnap } from './hooks/useSnap'
import { useTheme } from './hooks/useTheme'
import { buildSampleItems } from './lib/sampleBoard'
import { defaultLinkSize } from './lib/linkType'
import {
  buildBackup,
  restoreBackup,
  isBackupPayload,
  formatBytes,
  MAX_BLOB_BYTES,
  WARN_TOTAL_BYTES,
  MAX_TOTAL_BYTES,
  MAX_IMPORT_FILE_BYTES,
} from './lib/backup'
import BoardItem from './components/BoardItem'
import Toolbar from './components/Toolbar'
import EmptyState from './components/EmptyState'
import ShortcutsModal from './components/ShortcutsModal'

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

  // Keyboard-shortcuts help modal. Opens via the `?` key (Shift+/ on
  // most layouts) and via the toolbar's ⌨ Shortcuts pill. Esc closes
  // (the modal owns its own capture-phase Esc handler so App's global
  // Esc — deselect / exit Desktop Mode — does not also fire while
  // the modal is open).
  const [shortcutsOpen, setShortcutsOpen] = useState(false)

  // Single-card Focus mode. Double-clicking a card sets this to its id;
  // BoardItem then renders a centered, enlarged overlay copy of the
  // card's content. ALL of this is transient React state — we never
  // mutate `item.x / y / width / height` and never write to localStorage,
  // so refreshing the page after focusing always restores the original
  // size and position. Esc and clicking the backdrop both clear it.
  const [focusedItemId, setFocusedItemId] = useState(null)
  // Auto-clear focus if the focused item is removed from the board
  // (e.g. via the delete key or the trash icon). Without this the
  // overlay would render against a stale id and just disappear at
  // next render — clearing eagerly keeps state honest.
  useEffect(() => {
    if (focusedItemId && !items.some((it) => it.id === focusedItemId)) {
      setFocusedItemId(null)
    }
  }, [focusedItemId, items])

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
    displayMode,
    toggleDisplayMode,
  } = useDesktopMode()

  // Snap-to-grid preference (off by default, persisted in its own
  // localStorage key — does NOT touch the board layout key owned by
  // useBoard). When on, BoardItem applies react-rnd's native dragGrid
  // and resizeGrid props, and renders subtle alignment guide lines
  // while a card is being dragged or resized.
  const { snap, toggleSnap, gridSize: snapGrid } = useSnap()

  // Board-level view preferences (board opacity + focus mode), persisted
  // in their own `muraldesk-view` localStorage key. Independent of
  // useBoard / useSnap / IndexedDB. boardOpacity is a runtime visual
  // multiplier — per-item `item.opacity` values stay untouched so a
  // refresh / export / import round-trips identical item shapes.
  const {
    boardOpacity,
    focusMode,
    cycleBoardOpacity,
    toggleFocusMode,
  } = useBoardView()

  // Theme + accent. Owns its own `muraldesk-theme` localStorage key
  // (independent of board / snap / view / IDB) and applies data-theme
  // + data-accent on <html> synchronously before paint. Default is
  // dark / purple so first paint matches the pre-theming look exactly.
  // In Electron the existing data-electron rule keeps the root
  // transparent regardless of theme, so neither light nor dark mode
  // ever bleeds a full background into the transparent overlay.
  const {
    mode: themeMode,
    accent: themeAccent,
    cycleMode: cycleThemeMode,
    cycleAccent: cycleThemeAccent,
  } = useTheme()

  // Mark <html data-electron="true"> so src/index.css can paint the
  // root transparent in the Electron build. The web/PWA build never
  // sets this attribute and keeps its themed canvas background.
  //
  // useLayoutEffect (synchronous, before paint) — NOT useEffect — so
  // this attribute is set on the same pre-paint pass as useTheme's
  // data-theme / data-accent. Otherwise, an Electron cold-start with
  // a saved 'light' theme would briefly paint a white body background
  // (var(--bg) for light) before the post-paint useEffect could apply
  // the !important transparent rule, producing a one-frame white flash
  // over the user's desktop. Both layout effects flush in the same
  // commit before browser paint, so the order between them is
  // irrelevant — the transparent !important rule always wins from the
  // first paint forward.
  useLayoutEffect(() => {
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
    // No `color` field → NoteCard falls back to var(--note-bg-default)
    // so freshly-added notes follow the active theme. Existing notes
    // keep whatever color was previously persisted.
    addItem('note', {
      text: '', width: w, height: h, ...spawnPosFor(w, h),
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
    // See handleAddNote — same theme-aware default note color.
    addItem('note', {
      text: '', width: w, height: h,
      ...spawnPosFor(w, h, { center: true }),
    })
  }, [addItem, spawnPosFor])

  const handleAddLink = useCallback((url, title, description) => {
    // Pick a default size that fits the link's preview kind: 16:9-ish for
    // YouTube / direct video, taller for images, compact for plain web.
    const { width, height } = defaultLinkSize(url)
    addItem('link', { url, title, description, width, height, ...spawnPosFor(width, height) })
  }, [addItem, spawnPosFor])

  // Tidy: shelf-pack every item left-to-right, top-to-bottom into the
  // visible viewport area, preserving each item's width/height. Only
  // x/y are updated, via the same `updateItem` API the drag/resize
  // handlers already use — so the change persists through the normal
  // useBoard → localStorage path with zero new storage code. Items are
  // tidied in their current array order (which already reflects the
  // user's add / duplicate ordering); we don't re-sort by size, color,
  // or kind so the result feels predictable.
  //
  // Layout area: x ∈ [PAD_X, vw - PAD_X], y ∈ [TOP_Y, vh - PAD_Y].
  // TOP_Y = 130 reserves the top-center toolbar pill on web; in
  // Electron transparent overlay the toolbar sits in the same band so
  // the same reservation works there. Spacing between cards is GAP px
  // on both axes. If a single item is wider than the available width
  // (e.g. user resized a card to fill a huge monitor and then shrank
  // their window), we still place it on its own row at x = PAD_X — we
  // never silently shrink anyone's card.
  //
  // Confirmation gate: > 10 items prompts before applying. The cycle
  // is intentionally non-undoable because we don't own undo history;
  // the prompt is the safety net.
  const handleTidy = useCallback(() => {
    if (!items.length) return
    if (items.length > 10) {
      const ok = confirm(
        `Tidy will rearrange ${items.length} items into a clean grid. Continue?`,
      )
      if (!ok) return
    }
    const PAD_X = 24
    const PAD_Y = 24
    const TOP_Y = 130
    const GAP = 24
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1280
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800
    const maxRight = Math.max(PAD_X + 200, vw - PAD_X)
    let cursorX = PAD_X
    let cursorY = TOP_Y
    let rowHeight = 0
    for (const it of items) {
      const w = it.width || 200
      const h = it.height || 140
      // Wrap to a new shelf if this item won't fit the remainder of
      // the current row (and we've already placed at least one item
      // on this row — otherwise an oversize item just lives alone).
      if (cursorX !== PAD_X && cursorX + w > maxRight) {
        cursorX = PAD_X
        cursorY += rowHeight + GAP
        rowHeight = 0
      }
      const nx = Math.round(cursorX)
      const ny = Math.round(cursorY)
      // Skip the update if the position is already byte-identical —
      // useBoard's update path will short-circuit anyway, but skipping
      // here avoids N redundant React re-renders on an already-tidy
      // board and a no-op writeback to localStorage.
      if (nx !== it.x || ny !== it.y) {
        updateItem(it.id, { x: nx, y: ny })
      }
      cursorX += w + GAP
      if (h > rowHeight) rowHeight = h
    }
  }, [items, updateItem])

  const handleSampleBoard = useCallback(() => {
    // Always use the minimal sample (one image, one link, one small
    // sticky note centered on the current viewport). The previous
    // "rich" 3×3 grid included two onboarding-style note panels
    // (Welcome / Local-first) that felt like tutorial overlays
    // disguised as user content — wrong tone for a visual mural,
    // and the grid also overflowed below 1280×720 viewports. The
    // minimal layout reads as real mural content on every build
    // (Electron Desktop Mode, normal-window Electron, web/PWA).
    addItems(buildSampleItems({ minimal: true }))
  }, [addItems])

  // Quick layout export: a small JSON file with item metadata only.
  // Media (images/videos) is referenced by IDB id but the bytes are
  // NOT included, so this file is only fully restorable on the SAME
  // browser. Cross-machine portability uses handleExportBackup below.
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

  // Portable backup: same item metadata plus base64-encoded media
  // blobs from IDB. The on-disk file is `.muraldesk.json` (still a
  // JSON file, just with a distinguishing double extension so the
  // user can tell layouts and backups apart in their downloads
  // folder). See src/lib/backup.js for size limits + skip rules.
  const handleExportBackup = useCallback(async () => {
    const layout = exportLayout()
    let result
    try {
      result = await buildBackup(layout.items)
    } catch (err) {
      console.error(err)
      alert('Could not build backup.')
      return
    }
    const { payload, totalBytes, skipped, blobCount } = result

    // Skipped items break down into reasons we report differently:
    //   too-large   → user-actionable: "your file > 25 MB, won't fit"
    //   cap-reached → tell them we stopped at the total cap
    //   missing / unreadable → quietly note (rare; orphan / IDB error)
    const tooLarge = skipped.filter((s) => s.reason === 'too-large')
    const capHit = skipped.filter((s) => s.reason === 'cap-reached')
    const warnings = []
    if (tooLarge.length) {
      const list = tooLarge
        .slice(0, 5)
        .map((s) => `• ${s.label || `(untitled ${s.type})`} — ${formatBytes(s.size)}`)
        .join('\n')
      const more = tooLarge.length > 5 ? `\n… and ${tooLarge.length - 5} more` : ''
      warnings.push(
        `${tooLarge.length} item(s) have media larger than ${formatBytes(MAX_BLOB_BYTES)} per file and will NOT be in the backup. Their layout is preserved without media:\n${list}${more}`
      )
    }
    if (capHit.length) {
      warnings.push(
        `Total media exceeded ${formatBytes(MAX_TOTAL_BYTES)}; ${capHit.length} item(s) past the cap kept their layout but not their media.`
      )
    }
    if (totalBytes >= WARN_TOTAL_BYTES) {
      warnings.push(`Backup payload is ${formatBytes(totalBytes)} of media (~${formatBytes(Math.round(totalBytes * 1.34))} on disk).`)
    }
    if (warnings.length) {
      const ok = confirm(`${warnings.join('\n\n')}\n\nContinue with the backup?`)
      if (!ok) return
    }

    const json = JSON.stringify(payload)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    a.download = `muraldesk-backup-${stamp}.muraldesk.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 0)

    // Reassuring tail message (non-blocking) so the user knows what
    // they got — count items vs. media to make the difference clear.
    if (blobCount > 0 || skipped.length > 0) {
      console.info(
        `[muraldesk] Backup created — ${payload.items.length} item(s), ${blobCount} media blob(s) (${formatBytes(totalBytes)}), ${skipped.length} skipped.`
      )
    }
  }, [exportLayout])

  // Single Import handler that auto-detects layout-only vs. backup
  // payloads via isBackupPayload(). Backup files restore media to
  // IDB BEFORE calling importLayout, so the existing hydrateMediaSrcs
  // step in useBoard sees the populated IDB and rebuilds `src` URLs
  // exactly as on a normal load — no changes to useBoard.js.
  const handleImport = useCallback((file) => {
    const MAX_LAYOUT_BYTES = 5 * 1024 * 1024 // 5 MB for plain layouts
    const MAX_IMPORT_ITEMS = 500
    // The backup limit is generous because base64 inflation makes
    // the on-disk file substantially larger than the raw blob bytes.
    // We don't yet know which kind of file we have, so allow up to
    // the larger of the two and decide after parsing.
    if (file.size > MAX_IMPORT_FILE_BYTES) {
      alert(`File is too large (${formatBytes(file.size)}). Max ${formatBytes(MAX_IMPORT_FILE_BYTES)}.`)
      return
    }
    const reader = new FileReader()
    reader.onload = async () => {
      let parsed
      try {
        parsed = JSON.parse(reader.result)
      } catch (err) {
        console.error(err)
        alert('Could not read that file (not valid JSON).')
        return
      }

      // Helper: drop unsafe protocols on link items so an imported
      // javascript:/data: URL can never become a clickable href.
      const sanitize = (arr) => arr.map((it) => {
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

      // ── Backup (.muraldesk.json) path ──
      if (isBackupPayload(parsed)) {
        if (!Array.isArray(parsed.items)) {
          alert('Backup file is missing its items list.')
          return
        }
        if (parsed.items.length > MAX_IMPORT_ITEMS) {
          alert(`Backup has too many items (${parsed.items.length}). Max is ${MAX_IMPORT_ITEMS}.`)
          return
        }
        const mediaCount = Object.keys(parsed.media || {}).length
        const ok = items.length === 0
          ? true
          : confirm(`Replace your current board with backup contents (${parsed.items.length} item(s) + ${mediaCount} media)?`)
        if (!ok) return
        let restoreResult
        try {
          restoreResult = await restoreBackup({ ...parsed, items: sanitize(parsed.items) })
        } catch (err) {
          console.error(err)
          alert(`Could not restore backup: ${err.message}`)
          return
        }
        await importLayout(restoreResult.items)
        setSelectedId(null)
        if (restoreResult.mediaFailures > 0) {
          alert(`Restored ${restoreResult.items.length} item(s). ${restoreResult.mediaFailures} media reference(s) could not be decoded; their items show without media.`)
        }
        return
      }

      // ── Quick layout JSON path (existing behavior) ──
      // Layout-only files have a stricter file-size limit since they
      // shouldn't contain blob data; reject early if the file is
      // suspiciously large for that path.
      if (file.size > MAX_LAYOUT_BYTES) {
        alert(`Layout file is too large (${formatBytes(file.size)}). Max ${formatBytes(MAX_LAYOUT_BYTES)} for plain layouts. (Did you mean to import a backup file?)`)
        return
      }
      let incoming = Array.isArray(parsed) ? parsed : parsed?.items
      if (!Array.isArray(incoming)) {
        alert('That file does not look like a MuralDesk layout or backup.')
        return
      }
      if (incoming.length > MAX_IMPORT_ITEMS) {
        alert(`Layout has too many items (${incoming.length}). Max is ${MAX_IMPORT_ITEMS}.`)
        return
      }
      incoming = sanitize(incoming)
      const ok = items.length === 0
        ? true
        : confirm(`Replace your current board with ${incoming.length} imported item(s)?`)
      if (!ok) return
      try {
        await importLayout(incoming)
        setSelectedId(null)
      } catch (err) {
        console.error(err)
        alert('Could not import that layout.')
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
      // `?` opens the shortcuts modal. The character `?` is what the
      // browser reports for Shift+/ on US/most layouts, and for the
      // dedicated `?` key on layouts that have one — so this works
      // universally without us having to special-case Shift+Slash.
      // Skipped while editing text (handled by the isEditableTarget
      // gate above) so it never eats a real `?` keystroke in a note.
      if (e.key === '?') {
        e.preventDefault()
        setShortcutsOpen((v) => !v)
        return
      }
      if (e.key === 'Escape') {
        // Esc priority order: close Focus mode first (most-recent
        // transient mode wins), then exit Desktop Mode, then deselect.
        // Each step returns so a single Esc only collapses one layer.
        if (focusedItemId) {
          setFocusedItemId(null)
          return
        }
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
    isElectron, toggleDesktopMode, handleAddNoteCentered, focusedItemId,
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
          snap={snap}
          snapGrid={snapGrid}
          boardOpacity={boardOpacity}
          focused={focusedItemId === item.id}
          onRequestFocus={() => setFocusedItemId(item.id)}
          onExitFocus={() => setFocusedItemId(null)}
          isElectron={isElectron}
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
        onTidy={handleTidy}
        onExport={handleExport}
        onExportBackup={handleExportBackup}
        onImport={handleImport}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
        isElectron={isElectron}
        desktopMode={desktopMode}
        onToggleDesktopMode={toggleDesktopMode}
        displayMode={displayMode}
        onToggleDisplayMode={toggleDisplayMode}
        hasItems={items.length > 0}
        anyItemHovered={anyItemHovered}
        snap={snap}
        onToggleSnap={toggleSnap}
        boardOpacity={boardOpacity}
        onCycleBoardOpacity={cycleBoardOpacity}
        focusMode={focusMode}
        onToggleFocusMode={toggleFocusMode}
        themeMode={themeMode}
        themeAccent={themeAccent}
        onCycleThemeMode={cycleThemeMode}
        onCycleThemeAccent={cycleThemeAccent}
        onMinimizeWindow={handleMinimize}
        onCloseWindow={handleClose}
        manualOverride={manualToolbarOverride}
        onOpenShortcuts={() => setShortcutsOpen(true)}
      />

      <ShortcutsModal
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
        isElectron={isElectron}
      />
    </div>
  )
}
