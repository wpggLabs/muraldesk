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

  return [
    {
      id: uuidv4(),
      type: 'note',
      text: '👋 Welcome to MuralDesk\n\nA visual desk for ambient inspiration.\nPin images, looping videos, links, and notes.\n\nEverything stays on your machine.',
      x: 80 + offsetX,
      y: 80 + offsetY,
      width: 280,
      height: 200,
      color: '#2a2a3a',
      zIndex: baseZ + 1,
    },
    {
      id: uuidv4(),
      type: 'note',
      text: '✨ Tips\n\n• Drag the top strip to move\n• Pull the bottom-right corner to resize\n• Hover for lock / duplicate / delete\n• Press Delete to remove the selected card\n• Press Esc to deselect',
      x: 400 + offsetX,
      y: 80 + offsetY,
      width: 300,
      height: 220,
      color: '#2d2a1a',
      zIndex: baseZ + 2,
    },
    {
      id: uuidv4(),
      type: 'image',
      src: SAMPLE_IMAGE_SRC,
      label: 'Sample image',
      x: 80 + offsetX,
      y: 320 + offsetY,
      width: 320,
      height: 220,
      zIndex: baseZ + 3,
    },
    {
      id: uuidv4(),
      type: 'link',
      url: 'https://en.wikipedia.org/wiki/Mood_board',
      title: 'What is a mood board?',
      description: 'Visual collections that capture aesthetic and creative direction.',
      x: 420 + offsetX,
      y: 340 + offsetY,
      width: 280,
      height: 180,
      zIndex: baseZ + 4,
    },
  ]
}
