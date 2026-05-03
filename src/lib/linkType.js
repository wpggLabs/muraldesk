// Classifies a user-supplied link URL so the LinkCard can render it as a
// rich preview when possible (YouTube / Vimeo / SoundCloud / Spotify /
// CodePen embed, playable video, inline image) and otherwise fall back to
// the plain "Open" card.
//
// Safety contract — applies to EVERY branch in this file:
//   1. The raw URL is fed through the URL constructor. Anything that
//      doesn't parse → 'unsafe'.
//   2. Only http: and https: schemes pass. Anything else (javascript:,
//      data:, file:, mailto:, vbscript:, ftp:, ws:, …) → 'unsafe'.
//   3. The host is normalized (www-stripped, lowercased) and matched
//      against an allow-list per provider.
//   4. The id / slug used to BUILD the embed URL is validated against a
//      strict regex (digits / base62 / [\w-]). The embed URL is then
//      assembled from the validated pieces — never by string-concat of
//      the raw input — so a malformed segment can never sneak unsafe
//      characters into the iframe `src`.
//   5. If validation fails at any step the URL falls through to plain
//      'web' (a regular Open-button card), NEVER to a half-built embed.
//
// LinkCard adds the iframe-level defenses (sandbox, referrerPolicy,
// allow-list of feature policies) on top of the embedSrc returned here.

const VIDEO_EXT = /\.(mp4|webm|ogg|ogv|mov|m4v)(\?|#|$)/i
const IMAGE_EXT = /\.(jpe?g|png|gif|webp|svg|avif|apng|bmp)(\?|#|$)/i

const YT_HOSTS = new Set([
  'youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtube-nocookie.com',
  'youtu.be',
])

const VIMEO_HOSTS = new Set(['vimeo.com', 'player.vimeo.com'])

// Only the canonical soundcloud.com domain is embeddable. The mobile
// host (`m.soundcloud.com`) and the player host (`w.soundcloud.com`)
// are intentionally excluded:
//   - m.* serves the same paths so we just normalize to soundcloud.com.
//   - on.soundcloud.com is a server-side shortlink redirector — we
//     can't validate the destination from the URL alone, so we refuse
//     to construct a widget URL for it (falls back to a plain Open card).
//   - w.soundcloud.com is the embed origin itself; refusing to re-embed
//     prevents an embed-of-an-embed that would let a crafted query
//     string bypass our auto_play / hide_related defaults.
const SOUNDCLOUD_HOSTS = new Set(['soundcloud.com', 'm.soundcloud.com'])

// Spotify's open.spotify.com is the only embeddable host. spotify.com
// (no `open.`) typically redirects to a marketing page or the desktop
// app; we map it through to open.spotify.com only if the path looks
// like a content URL.
const SPOTIFY_HOSTS = new Set(['open.spotify.com', 'spotify.com'])

// Spotify content types that have a working /embed/ player. `local-file`
// and `user/...` (profile) are intentionally excluded — they don't have
// a meaningful embed and would 404 in the iframe.
const SPOTIFY_TYPES = new Set(['track', 'album', 'playlist', 'episode', 'show', 'artist'])

const CODEPEN_HOSTS = new Set(['codepen.io'])

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

  // ---- YouTube — sandboxed nocookie embed.
  const ytId = extractYouTubeId(parsed, host)
  if (ytId) {
    const embedSrc =
      `https://www.youtube-nocookie.com/embed/${ytId}` +
      `?autoplay=1&mute=1&loop=1&playlist=${ytId}` +
      `&controls=0&modestbranding=1&rel=0&playsinline=1&disablekb=1`
    const watchUrl = `https://www.youtube.com/watch?v=${ytId}`
    return { kind: 'youtube', videoId: ytId, embedSrc, watchUrl, url, hostname: host }
  }

  // ---- Vimeo — background-mode autoplay loop, Interact for controls.
  const vimeo = extractVimeo(parsed, host)
  if (vimeo) {
    return { kind: 'vimeo', ...vimeo, url, hostname: host }
  }

  // ---- SoundCloud — widget player keyed off the canonical track / set URL.
  const sc = extractSoundCloud(parsed, host)
  if (sc) {
    return { kind: 'soundcloud', ...sc, url, hostname: host }
  }

  // ---- Spotify — /embed/<type>/<id> player.
  const sp = extractSpotify(parsed, host)
  if (sp) {
    return { kind: 'spotify', ...sp, url, hostname: host }
  }

  // ---- CodePen — /<user>/embed/<slug> rendered-result preview.
  const cp = extractCodePen(parsed, host)
  if (cp) {
    return { kind: 'codepen', ...cp, url, hostname: host }
  }

  // ---- Direct media URLs based on extension in the path.
  const path = parsed.pathname || ''
  if (VIDEO_EXT.test(path)) return { kind: 'video', url, hostname: host }
  if (IMAGE_EXT.test(path)) return { kind: 'image', url, hostname: host }

  // Anything else: render as a regular Open-button card.
  return { kind: 'web', url, hostname: host }
}

// Returns a sensible default size {width, height} for a freshly-added link
// item based on what kind of preview it will render. Sizes are chosen so
// each provider's default UI is legible without further resizing — but
// every value still respects the BoardItem min-size guards (60×60), so a
// user's previously-resized item is never overridden.
export function defaultLinkSize(rawUrl) {
  const c = classifyLink(rawUrl)
  if (c.kind === 'youtube' || c.kind === 'video' || c.kind === 'vimeo') {
    return { width: 360, height: 220 }
  }
  if (c.kind === 'image') return { width: 280, height: 220 }
  if (c.kind === 'soundcloud') {
    // Sets need vertical room for the track list; single tracks fit the
    // 166-px-tall visual waveform with a little chrome.
    return { width: 360, height: c.contentType === 'set' ? 300 : 200 }
  }
  if (c.kind === 'spotify') {
    // Spotify's compact player (track / episode) is 80 px tall by spec;
    // the full player (album / playlist / show / artist) wants 380.
    const compact = c.contentType === 'track' || c.contentType === 'episode'
    return { width: 320, height: compact ? 100 : 380 }
  }
  if (c.kind === 'codepen') return { width: 480, height: 300 }
  return { width: 280, height: 160 }
}

// ---- YouTube ----------------------------------------------------------------

function extractYouTubeId(parsed, host) {
  if (!YT_HOSTS.has(host)) return null

  // youtu.be/<id>
  if (host === 'youtu.be') {
    return validYouTubeId(parsed.pathname.slice(1).split('/')[0])
  }

  // youtube.com/watch?v=<id>
  if (parsed.pathname === '/watch') {
    return validYouTubeId(parsed.searchParams.get('v'))
  }

  // youtube.com/{shorts|embed|live|v}/<id>
  const m = parsed.pathname.match(/^\/(shorts|embed|live|v)\/([^/]+)/)
  if (m) return validYouTubeId(m[2])

  return null
}

function validYouTubeId(id) {
  if (!id) return null
  // YouTube video IDs are 11 chars from [A-Za-z0-9_-]
  return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null
}

// ---- Vimeo ------------------------------------------------------------------

function extractVimeo(parsed, host) {
  if (!VIMEO_HOSTS.has(host)) return null

  let id = null
  if (host === 'player.vimeo.com') {
    // Already an embed URL — extract id but rebuild a fresh src so any
    // hostile query params (e.g. `?h=hash` for private videos we don't
    // know about, or a malformed `&onload=…`) are stripped.
    const m = parsed.pathname.match(/^\/video\/(\d+)/)
    if (m) id = m[1]
  } else {
    // vimeo.com paths take many shapes:
    //   /<id>
    //   /<channel>/<id>
    //   /album/<a>/video/<id>
    //   /showcase/<s>/video/<id>
    //   /groups/<g>/videos/<id>
    // The video id is always the last all-digits segment, so search
    // from the end. 4-12 digits matches Vimeo's range (early public
    // videos used 4-5 digit IDs, modern ones use 9-10).
    const segs = parsed.pathname.split('/').filter(Boolean)
    for (let i = segs.length - 1; i >= 0; i--) {
      if (/^\d{4,12}$/.test(segs[i])) { id = segs[i]; break }
    }
  }
  if (!id) return null

  // Background mode = no controls, autoplay, muted, looped — matches
  // the YouTube card's idle-feel. Interact mode in LinkCard switches
  // pointerEvents to allow hover/click on the iframe; Vimeo's default
  // controls reappear when you mouse over the player there.
  const embedSrc =
    `https://player.vimeo.com/video/${id}` +
    `?autoplay=1&muted=1&loop=1&background=1&dnt=1`
  const watchUrl = `https://vimeo.com/${id}`
  return { videoId: id, embedSrc, watchUrl }
}

// ---- SoundCloud -------------------------------------------------------------

function extractSoundCloud(parsed, host) {
  if (!SOUNDCLOUD_HOSTS.has(host)) return null

  // Path shapes we accept:
  //   /<user>/<track-slug>           track
  //   /<user>/sets/<set-slug>        playlist / set
  // Anything else (search, /you, profile root, /tracks reposts, etc.)
  // falls back to a plain web card.
  const segs = parsed.pathname.split('/').filter(Boolean)
  let contentType = null
  if (
    segs.length === 2 &&
    /^[\w.-]+$/.test(segs[0]) &&
    /^[\w.-]+$/.test(segs[1]) &&
    segs[1] !== 'sets'
  ) {
    contentType = 'track'
  } else if (
    segs.length === 3 &&
    segs[1] === 'sets' &&
    /^[\w.-]+$/.test(segs[0]) &&
    /^[\w.-]+$/.test(segs[2])
  ) {
    contentType = 'set'
  } else {
    return null
  }

  // Normalize to the canonical hostname and drop any query/hash so a
  // malicious `?widget_referrer=<script>` can't ride along.
  const canonical = `https://soundcloud.com/${segs.join('/')}`
  // The player widget accepts the canonical URL via ?url=; visual=true
  // shows the artwork+waveform, hide_related avoids the "next track"
  // panel that can overflow small cards.
  const embedSrc =
    `https://w.soundcloud.com/player/?url=${encodeURIComponent(canonical)}` +
    `&auto_play=false&hide_related=true&show_comments=false` +
    `&show_user=true&show_reposts=false&show_teaser=false&visual=true`
  return { embedSrc, watchUrl: canonical, contentType }
}

// ---- Spotify ----------------------------------------------------------------

function extractSpotify(parsed, host) {
  if (!SPOTIFY_HOSTS.has(host)) return null

  // Spotify localizes URLs as /intl-xx/<type>/<id> or /intl-xx-XX/<type>/<id>
  // (e.g. /intl-de/track/…, /intl-en-US/album/…). Strip the locale
  // prefix before matching. The matcher accepts 2 letters + optional
  // region with 2-3 letters/digits, case-insensitive.
  let segs = parsed.pathname.split('/').filter(Boolean)
  if (segs[0] && /^intl-[a-z]{2}(-[a-z0-9]{2,3})?$/i.test(segs[0])) {
    segs = segs.slice(1)
  }

  // Accept the embed URL directly: /embed/<type>/<id>. We rebuild the
  // canonical embed src from the validated pieces, so any extra junk
  // in the original query/hash is discarded.
  if (segs[0] === 'embed') segs = segs.slice(1)

  if (segs.length < 2) return null

  const [type, rawId] = segs
  if (!SPOTIFY_TYPES.has(type)) return null

  // Spotify IDs are 22-char base62 (alphanumeric, no padding). A
  // strict length+charset check means we can paste the validated id
  // straight into the embed URL.
  if (!/^[A-Za-z0-9]{22}$/.test(rawId)) return null

  const embedSrc = `https://open.spotify.com/embed/${type}/${rawId}`
  const watchUrl = `https://open.spotify.com/${type}/${rawId}`
  return { embedSrc, watchUrl, contentType: type, contentId: rawId }
}

// ---- CodePen ----------------------------------------------------------------

function extractCodePen(parsed, host) {
  if (!CODEPEN_HOSTS.has(host)) return null

  // CodePen URL shapes we accept:
  //   /<user>/{pen|embed|details|full|debug}/<slug>            personal pen
  //   /team/<team>/{pen|embed|details|full|debug}/<slug>       team pen
  // Slug is strict base62 — a hostile slug like "abc?onload=1" cannot
  // pass this gate, so the assembled embed src can never carry sneaky
  // query params from the input.
  const PEN_KIND = '(?:pen|embed|details|full|debug)'
  const SLUG = '([A-Za-z0-9]+)'
  const NAME = '([\\w-]+)'

  let user, slug
  // Try team first since `team` is a literal segment that would
  // otherwise match the `<user>` group below.
  const teamRe = new RegExp(`^/team/${NAME}/${PEN_KIND}/${SLUG}/?$`)
  const userRe = new RegExp(`^/${NAME}/${PEN_KIND}/${SLUG}/?$`)
  const teamM = parsed.pathname.match(teamRe)
  if (teamM) {
    // For team pens the canonical embed path is the same shape as
    // user pens but namespaced under /team/<team>/. CodePen accepts
    // `/team/<team>/embed/<slug>` and that's what we build.
    const team = teamM[1]
    slug = teamM[2]
    user = `team/${team}`
  } else {
    const userM = parsed.pathname.match(userRe)
    if (!userM) return null
    user = userM[1]
    slug = userM[2]
    // Reject the literal "team" as a username — that's the team-prefix
    // path we already handled above; if we got here with user==='team'
    // the URL is malformed (only 3 segments instead of 4).
    if (user === 'team') return null
  }

  // /embed/ is the canonical embed path. default-tab=result shows the
  // rendered output (matches the spec's "convert to safe iframe embed
  // URLs"); editable=false hides the live editor (cards are usually
  // too small for it and an editor on a draggable card invites focus
  // races with react-rnd).
  const embedSrc =
    `https://codepen.io/${user}/embed/${slug}` +
    `?default-tab=result&editable=false&theme-id=dark`
  const watchUrl = `https://codepen.io/${user}/pen/${slug}`
  return { embedSrc, watchUrl, user, slug }
}
