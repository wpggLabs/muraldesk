// Classifies a user-supplied link URL so the LinkCard can render it as a
// rich preview when possible (YouTube embed, playable video, inline image)
// and otherwise fall back to the plain "Open" card.
//
// All inputs go through the URL constructor and are required to be http(s).
// Anything that does not parse, or uses any other scheme (javascript:, data:,
// file:, mailto:, etc.), is reported as 'unsafe' and rendered as a
// non-clickable card by LinkCard.

const VIDEO_EXT = /\.(mp4|webm|ogg|ogv|mov|m4v)(\?|#|$)/i
const IMAGE_EXT = /\.(jpe?g|png|gif|webp|svg|avif|apng|bmp)(\?|#|$)/i

const YT_HOSTS = new Set([
  'youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtube-nocookie.com',
  'youtu.be',
])

export function classifyLink(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return { kind: 'unsafe' }

  let parsed
  try {
    parsed = new URL(rawUrl)
  } catch {
    return { kind: 'unsafe' }
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { kind: 'unsafe' }
  }

  const host = parsed.hostname.replace(/^www\./, '').toLowerCase()
  const url = parsed.toString()

  // YouTube — return a sandboxed nocookie embed URL with a known shape.
  const ytId = extractYouTubeId(parsed, host)
  if (ytId) {
    const embedSrc =
      `https://www.youtube-nocookie.com/embed/${ytId}` +
      `?autoplay=1&mute=1&loop=1&playlist=${ytId}` +
      `&controls=0&modestbranding=1&rel=0&playsinline=1&disablekb=1`
    const watchUrl = `https://www.youtube.com/watch?v=${ytId}`
    return { kind: 'youtube', videoId: ytId, embedSrc, watchUrl, url, hostname: host }
  }

  // Direct media URLs based on extension in the path.
  const path = parsed.pathname || ''
  if (VIDEO_EXT.test(path)) return { kind: 'video', url, hostname: host }
  if (IMAGE_EXT.test(path)) return { kind: 'image', url, hostname: host }

  // Anything else: render as a regular Open-button card.
  return { kind: 'web', url, hostname: host }
}

// Returns a sensible default size {width, height} for a freshly-added link
// item based on what kind of preview it will render.
export function defaultLinkSize(rawUrl) {
  const c = classifyLink(rawUrl)
  if (c.kind === 'youtube' || c.kind === 'video') return { width: 360, height: 220 }
  if (c.kind === 'image') return { width: 280, height: 220 }
  return { width: 280, height: 160 }
}

function extractYouTubeId(parsed, host) {
  if (!YT_HOSTS.has(host)) return null

  // youtu.be/<id>
  if (host === 'youtu.be') {
    return validId(parsed.pathname.slice(1).split('/')[0])
  }

  // youtube.com/watch?v=<id>
  if (parsed.pathname === '/watch') {
    return validId(parsed.searchParams.get('v'))
  }

  // youtube.com/{shorts|embed|live|v}/<id>
  const m = parsed.pathname.match(/^\/(shorts|embed|live|v)\/([^/]+)/)
  if (m) return validId(m[2])

  return null
}

function validId(id) {
  if (!id) return null
  // YouTube video IDs are 11 chars from [A-Za-z0-9_-]
  return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null
}
