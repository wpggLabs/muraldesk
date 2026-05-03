// backup.js — portable backup format for MuralDesk.
//
// MuralDesk has TWO export paths:
//
//   1. Quick layout export (useBoard.exportLayout) — a small JSON of
//      board items where media is referenced by IndexedDB id only.
//      Compact, but only restorable on the SAME machine because the
//      `mediaId` strings have no value outside this browser's IDB.
//
//   2. Backup export (this file) — the same layout JSON PLUS a `media`
//      map containing the actual blob bytes encoded as base64. The
//      file is portable: download it, drop it on another machine, and
//      `restoreBackup` writes the blobs back into IDB at their
//      original mediaIds, then the existing useBoard.importLayout
//      hydrates `src` URLs from IDB exactly as it does on first load.
//
// Persistence is otherwise unchanged: localStorage still stores ONLY
// layout metadata (never blobs); IndexedDB still owns blobs.
// `mediaStore.js` and `useBoard.js` are untouched by this feature.

import { getBlob, saveBlob } from './mediaStore'

// ── Size limits ────────────────────────────────────────────────────
//
// All thresholds are RAW blob bytes (pre-base64). Base64 inflates
// bytes by ~33%, so the on-disk JSON file is roughly totalBytes * 1.34
// plus a small JSON / metadata overhead.

// Per-blob hard limit. Items whose blob exceeds this are NOT included
// in the backup's media map; their layout metadata is preserved with
// `mediaId` stripped so there's no dangling reference on restore.
// 25 MB easily fits a high-quality JPEG / PNG / short clip; rejects a
// raw multi-minute video, which defeats the purpose of a portable
// backup file.
export const MAX_BLOB_BYTES = 25 * 1024 * 1024

// Soft warning threshold for total raw blob bytes. Above this we
// confirm() with the user before triggering the download — useful
// because base64 inflation makes the on-disk file noticeably larger
// than the raw total they might intuit.
export const WARN_TOTAL_BYTES = 50 * 1024 * 1024

// Hard cap on total raw blob bytes included in a single backup. Items
// encountered after the cap is reached are exported with metadata
// only (mediaId stripped). 100 MB raw → ~133 MB JSON file.
export const MAX_TOTAL_BYTES = 100 * 1024 * 1024

// Hard cap on imported backup FILE size on disk. 200 MB allows up to
// ~150 MB of raw blobs after base64 inflation, with headroom for
// metadata. Files larger than this are refused outright BEFORE we
// load them into memory.
export const MAX_IMPORT_FILE_BYTES = 200 * 1024 * 1024

export const BACKUP_KIND = 'backup'
export const BACKUP_VERSION = 1

// ── Encoding helpers ───────────────────────────────────────────────

// FileReader.readAsDataURL returns "data:<mime>;base64,<b64>". We
// strip the prefix to keep just the base64 payload, since the MIME
// type is stored separately in the backup payload.
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => {
      const s = r.result
      const i = typeof s === 'string' ? s.indexOf(',') : -1
      resolve(i >= 0 ? s.slice(i + 1) : '')
    }
    r.onerror = () => reject(r.error || new Error('Could not read blob'))
    r.readAsDataURL(blob)
  })
}

function base64ToBlob(b64, mime) {
  const bin = atob(b64)
  const len = bin.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i += 1) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: mime || 'application/octet-stream' })
}

// ── Build / restore ────────────────────────────────────────────────

// Build a backup payload from the items array as produced by
// useBoard.exportLayout (i.e. media items already have `mediaId` and
// no transient `src`).
//
// Returns:
//   payload     — object to JSON.stringify and download
//   totalBytes  — sum of raw blob bytes that ARE included
//   blobCount   — number of media entries in payload.media
//   skipped     — array of { id, label, type, size, reason } for any
//                 item whose media could NOT be included (the item's
//                 metadata IS still in payload.items, with mediaId
//                 stripped). reason ∈ 'too-large' | 'cap-reached' |
//                 'missing' | 'unreadable'.
//
// Iteration order matches the input items order; the cap is applied
// in that order (no "fit largest first" heuristic — keeps behavior
// predictable and avoids surprising users who carefully order items).
export async function buildBackup(items) {
  if (!Array.isArray(items)) {
    throw new Error('buildBackup: items must be an array')
  }
  const media = {}
  const skipped = []
  const outItems = []
  let totalBytes = 0

  for (const it of items) {
    if (!it || typeof it !== 'object') continue
    if (!it.mediaId) {
      // Non-media item (note, link, image-by-URL) — pass through.
      outItems.push(it)
      continue
    }

    let blob = null
    try {
      blob = await getBlob(it.mediaId)
    } catch (err) {
      skipped.push({ id: it.id, label: it.label, type: it.type, size: 0, reason: 'unreadable' })
      const { mediaId, ...rest } = it
      outItems.push(rest)
      continue
    }
    if (!blob) {
      // Item references a mediaId that's no longer in IDB.
      skipped.push({ id: it.id, label: it.label, type: it.type, size: 0, reason: 'missing' })
      const { mediaId, ...rest } = it
      outItems.push(rest)
      continue
    }
    if (blob.size > MAX_BLOB_BYTES) {
      skipped.push({ id: it.id, label: it.label, type: it.type, size: blob.size, reason: 'too-large' })
      const { mediaId, ...rest } = it
      outItems.push(rest)
      continue
    }
    if (totalBytes + blob.size > MAX_TOTAL_BYTES) {
      skipped.push({ id: it.id, label: it.label, type: it.type, size: blob.size, reason: 'cap-reached' })
      const { mediaId, ...rest } = it
      outItems.push(rest)
      continue
    }

    let data
    try {
      data = await blobToBase64(blob)
    } catch (err) {
      skipped.push({ id: it.id, label: it.label, type: it.type, size: blob.size, reason: 'unreadable' })
      const { mediaId, ...rest } = it
      outItems.push(rest)
      continue
    }
    media[it.mediaId] = {
      mime: blob.type || 'application/octet-stream',
      size: blob.size,
      data,
    }
    totalBytes += blob.size
    outItems.push(it)
  }

  const payload = {
    app: 'muraldesk',
    kind: BACKUP_KIND,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    items: outItems,
    media,
  }
  return { payload, totalBytes, skipped, blobCount: Object.keys(media).length }
}

// Restore a parsed backup payload. Writes media blobs into IndexedDB
// at their original mediaIds, then RETURNS the items array — caller
// should pass that to useBoard.importLayout, whose existing
// hydrateMediaSrcs step will then build `src` URLs from the
// now-populated IDB. Throws on validation failure so caller can
// surface a clear error message.
//
// Returns: { items, restored, mediaFailures }
//   restored       — number of media entries successfully written
//   mediaFailures  — entries referenced by items that couldn't be
//                    decoded / written. Their items still appear on
//                    the board but render as media-less placeholders.
export async function restoreBackup(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Backup file is not a JSON object.')
  }
  if (payload.kind !== BACKUP_KIND) {
    throw new Error('Not a MuralDesk backup file.')
  }
  if (!Array.isArray(payload.items)) {
    throw new Error('Backup is missing its items list.')
  }
  const media = payload.media && typeof payload.media === 'object' ? payload.media : {}
  const referenced = new Set(
    payload.items.map((it) => it && it.mediaId).filter(Boolean)
  )

  let restored = 0
  let mediaFailures = 0
  for (const id of referenced) {
    const entry = media[id]
    if (!entry || typeof entry.data !== 'string') {
      mediaFailures += 1
      continue
    }
    try {
      const blob = base64ToBlob(entry.data, entry.mime)
      await saveBlob(id, blob)
      restored += 1
    } catch (err) {
      mediaFailures += 1
    }
  }
  return { items: payload.items, restored, mediaFailures }
}

// Quick check used by the import auto-detector — distinguishes a
// backup file (has `kind: 'backup'` and a `media` object) from a
// plain layout export (no `kind`, no `media`).
export function isBackupPayload(parsed) {
  return !!(
    parsed &&
    typeof parsed === 'object' &&
    parsed.kind === BACKUP_KIND &&
    parsed.media &&
    typeof parsed.media === 'object'
  )
}

// Compact byte-formatter for confirm/alert messages. Not localized;
// matches what most desktop file managers show.
export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const u = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let n = bytes
  while (n >= 1024 && i < u.length - 1) {
    n /= 1024
    i += 1
  }
  return `${n < 10 && i > 0 ? n.toFixed(1) : Math.round(n)} ${u[i]}`
}
