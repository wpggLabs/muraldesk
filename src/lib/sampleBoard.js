import { v4 as uuidv4 } from 'uuid'

const SAMPLE_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 280" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#6c63ff"/>
      <stop offset="55%" stop-color="#ff6cb6"/>
      <stop offset="100%" stop-color="#3ecf8e"/>
    </linearGradient>
  </defs>
  <rect width="400" height="280" fill="url(#g)"/>
  <circle cx="100" cy="90" r="60" fill="rgba(255,255,255,0.16)"/>
  <circle cx="300" cy="200" r="90" fill="rgba(0,0,0,0.18)"/>
  <text x="200" y="160" text-anchor="middle" fill="white" font-family="-apple-system,Segoe UI,Roboto,sans-serif" font-size="22" font-weight="700" opacity="0.92">Sample image</text>
  <text x="200" y="186" text-anchor="middle" fill="white" font-family="-apple-system,Segoe UI,Roboto,sans-serif" font-size="12" opacity="0.7">Replace with your own</text>
</svg>`.trim()

const SAMPLE_IMAGE_SRC = 'data:image/svg+xml;utf8,' + encodeURIComponent(SAMPLE_SVG)

// Build a starter set of pinned items.
//
// Two flavors:
//   - default ("rich"): four items including two onboarding Note
//     cards (Welcome + Tips) and an image + link card. Used by the
//     web/PWA empty-state hero and by normal-window Electron mode.
//     `offsetX` / `offsetY` shift the whole set if a caller wants to
//     spawn relative to a custom origin.
//   - minimal: three clean mural objects centered on the current
//     viewport (one image, one link, one small sticky note — no
//     instructional panels). Used in Electron Desktop Canvas Mode
//     so clicking Sample doesn't dump big onboarding cards onto
//     what is meant to feel like an ambient desktop mural layer.
//
// `minimal` is read from a single options object so callers don't
// have to thread positional args through.
export function buildSampleItems(opts = {}) {
  const { minimal = false, offsetX = 0, offsetY = 0 } = opts
  const baseZ = Date.now()

  if (minimal) {
    // Center on the current viewport (which equals the display in
    // Desktop Mode). Fallback values keep this safe in non-browser
    // environments (e.g. SSR, tests).
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1280
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800
    const cx = vw / 2
    const cy = vh / 2

    const imgW = 280, imgH = 200
    const linkW = 260, linkH = 160
    const noteW = 200, noteH = 110

    return [
      {
        id: uuidv4(),
        type: 'image',
        src: SAMPLE_IMAGE_SRC,
        label: 'Sample image',
        // Slightly left of and above center.
        x: Math.max(20, Math.round(cx - imgW - 20)),
        y: Math.max(20, Math.round(cy - imgH - 20)),
        width: imgW,
        height: imgH,
        zIndex: baseZ + 1,
      },
      {
        id: uuidv4(),
        type: 'link',
        url: 'https://en.wikipedia.org/wiki/Mood_board',
        title: 'What is a mood board?',
        description: 'Visual collections that capture aesthetic and creative direction.',
        // Slightly right of and above center.
        x: Math.max(20, Math.round(cx + 20)),
        y: Math.max(20, Math.round(cy - linkH - 20)),
        width: linkW,
        height: linkH,
        zIndex: baseZ + 2,
      },
      {
        id: uuidv4(),
        type: 'note',
        text: 'Sample note',
        // Centered horizontally, just below the image/link row.
        x: Math.max(20, Math.round(cx - noteW / 2)),
        y: Math.max(20, Math.round(cy + 20)),
        width: noteW,
        height: noteH,
        color: '#2a2a3a',
        zIndex: baseZ + 3,
      },
    ]
  }

  // ----- Hand-arranged 3×3 mural at 1280×720 ---------------------------
  //
  // Column x's: 30 / 440 / 850 (380-wide cards, ~30px gutters).
  // Row y's:    130 / 330 / 560 (clears the floating toolbar at the
  //             top, leaves a 10px breather at the bottom).
  //
  // The grid intentionally mixes one note + one compact embed + one
  // note across the top row so the eye lands on words first, then
  // discovers the rich media in rows 2 and 3. Spotify's compact
  // 100-px-tall track player is centered vertically in its 180-px
  // row so it doesn't look stranded.
  //
  // Every URL below is a stable, canonical public reference
  // (Wikimedia Commons sample · Google's Big Buck Bunny mirror ·
  // Vimeo's classic "The Mountain" demo · Forss "Flickermood" on
  // SoundCloud · Nirvana on Spotify · Chris Coyier on CodePen). The
  // YouTube id is hard-coded into the link URL so the same
  // classifyLink path the user would hit applies — no special-cased
  // sample data shape.
  //
  // Z-ordering: each item is +1 above the previous so a freshly-
  // dropped sample board has a sensible front-to-back order, and
  // any new user item (which is added with `Date.now()` z-index)
  // automatically lands on top.
  const COL = { a: 30, b: 440, c: 850 }
  const W = 380
  const ZB = baseZ
  const ox = offsetX
  const oy = offsetY

  return [
    // Row 1 — Welcome note (col A, h=180)
    {
      id: uuidv4(),
      type: 'note',
      text: '👋 Welcome to MuralDesk\n\nA visual desk for ambient inspiration.\nPin images, videos, links, and notes —\neverything stays on your machine.',
      x: COL.a + ox,
      y: 130 + oy,
      width: W,
      height: 180,
      color: '#2a2a3a',
      zIndex: ZB + 1,
    },
    // Row 1 — Spotify (col B, compact track player, vertically centered in the 180-row)
    {
      id: uuidv4(),
      type: 'link',
      // Smells Like Teen Spirit — canonical, always-online demo track.
      url: 'https://open.spotify.com/track/5ghIJDpPoe3CfHMGu71E6T',
      title: 'Spotify track',
      x: COL.b + ox,
      y: 170 + oy,
      width: W,
      height: 100,
      zIndex: ZB + 2,
    },
    // Row 1 — Local-first reassurance note (col C, h=180)
    {
      id: uuidv4(),
      type: 'note',
      text: '🔒 Local-first\n\n· No account\n· No cloud\n· No tracking\n\nYour board lives on this machine.',
      x: COL.c + ox,
      y: 130 + oy,
      width: W,
      height: 180,
      color: '#1a2a25',
      zIndex: ZB + 3,
    },

    // Row 2 — YouTube (col A, h=210)
    {
      id: uuidv4(),
      type: 'link',
      // "Big Buck Bunny" official YouTube upload — public, always-online.
      url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
      title: 'YouTube embed',
      x: COL.a + ox,
      y: 330 + oy,
      width: W,
      height: 210,
      zIndex: ZB + 4,
    },
    // Row 2 — Vimeo (col B, h=210)
    {
      id: uuidv4(),
      type: 'link',
      // "The Mountain" by TSO Photography — Vimeo's classic public demo.
      url: 'https://vimeo.com/22439234',
      title: 'Vimeo embed',
      x: COL.b + ox,
      y: 330 + oy,
      width: W,
      height: 210,
      zIndex: ZB + 5,
    },
    // Row 2 — Direct image URL link card (col C, h=210)
    {
      id: uuidv4(),
      type: 'link',
      // Wikimedia Commons — Hubble's "Pillars of Creation" thumbnail.
      // Direct .jpg URL → LinkCard renders inline <img>.
      url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/68/Pillars_2014_HST_WFC3-UVIS_full-res_denoised.jpg/640px-Pillars_2014_HST_WFC3-UVIS_full-res_denoised.jpg',
      title: 'Direct image link',
      x: COL.c + ox,
      y: 330 + oy,
      width: W,
      height: 210,
      zIndex: ZB + 6,
    },

    // Row 3 — SoundCloud (col A, h=150)
    {
      id: uuidv4(),
      type: 'link',
      // Forss — "Flickermood": canonical creative-commons SC track.
      url: 'https://soundcloud.com/forss/flickermood',
      title: 'SoundCloud embed',
      x: COL.a + ox,
      y: 560 + oy,
      width: W,
      height: 150,
      zIndex: ZB + 7,
    },
    // Row 3 — Direct video URL link card (col B, h=150)
    {
      id: uuidv4(),
      type: 'link',
      // Google's public Big Buck Bunny mirror — stable .mp4 URL, no auth.
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      title: 'Direct video link',
      x: COL.b + ox,
      y: 560 + oy,
      width: W,
      height: 150,
      zIndex: ZB + 8,
    },
    // Row 3 — CodePen (col C, h=150)
    {
      id: uuidv4(),
      type: 'link',
      // Chris Coyier (CodePen co-founder) — small, stable demo pen.
      url: 'https://codepen.io/chriscoyier/pen/RwKwoyZ',
      title: 'CodePen embed',
      x: COL.c + ox,
      y: 560 + oy,
      width: W,
      height: 150,
      zIndex: ZB + 9,
    },
  ]
}
