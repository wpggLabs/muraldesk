// MuralDesk service worker — basic app-shell cache for installability
// and offline reload. Bumps cache name on every release.
const CACHE_PREFIX = 'muraldesk-shell-'
const CACHE_NAME = `${CACHE_PREFIX}v1`

const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icon.svg',
  '/icon-maskable.svg',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
      .catch(() => {})
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE_NAME)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  )
})

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting()
})

function isCacheableAsset(url) {
  const p = url.pathname
  return (
    p.endsWith('.js') ||
    p.endsWith('.mjs') ||
    p.endsWith('.css') ||
    p.endsWith('.svg') ||
    p.endsWith('.png') ||
    p.endsWith('.jpg') ||
    p.endsWith('.jpeg') ||
    p.endsWith('.webp') ||
    p.endsWith('.ico') ||
    p.endsWith('.woff') ||
    p.endsWith('.woff2') ||
    p.endsWith('.webmanifest')
  )
}

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return

  let url
  try {
    url = new URL(req.url)
  } catch {
    return
  }

  // Only handle http(s) — skip blob:, data:, chrome-extension:, etc. so
  // the app's IndexedDB-backed object URLs are never touched.
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return

  // Same-origin only; cross-origin requests pass through.
  if (url.origin !== self.location.origin) return

  // Never intercept Vite dev / Replit workspace endpoints.
  if (
    url.pathname.startsWith('/@vite') ||
    url.pathname.startsWith('/@react-refresh') ||
    url.pathname.startsWith('/@id') ||
    url.pathname.startsWith('/@fs') ||
    url.pathname.startsWith('/node_modules/') ||
    url.pathname.includes('/__replco/') ||
    url.searchParams.has('hmr')
  ) {
    return
  }

  // Navigation requests: network-first, fall back to cached shell when offline.
  // Only cache the response as the offline shell when it is actually a
  // successful HTML document — otherwise a 404/error page from the host could
  // poison the offline fallback for every future navigation.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const ct = res.headers.get('content-type') || ''
          if (res.ok && ct.includes('text/html')) {
            const copy = res.clone()
            caches
              .open(CACHE_NAME)
              .then((c) => c.put('/index.html', copy))
              .catch(() => {})
          }
          return res
        })
        .catch(() => caches.match('/index.html').then((m) => m || caches.match('/')))
    )
    return
  }

  // Static assets: cache-first, then revalidate in background.
  if (isCacheableAsset(url)) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const fetchPromise = fetch(req)
          .then((res) => {
            if (res && res.ok) {
              const copy = res.clone()
              caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {})
            }
            return res
          })
          .catch(() => cached)
        return cached || fetchPromise
      })
    )
  }
})
