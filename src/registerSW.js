// Register the service worker only in production builds AND only when the
// app is served over http(s). In dev we actively unregister any
// previously-installed SW so Vite HMR and the app's persistence hydration
// are never served stale assets from a leftover cache. In Electron the
// renderer is loaded via `file://`, where service workers don't apply, so
// we skip registration there too.
export function registerServiceWorker() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return

  const protocol = typeof location !== 'undefined' ? location.protocol : ''
  const isHttp = protocol === 'http:' || protocol === 'https:'

  if (import.meta.env.PROD && isHttp) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .catch((err) => console.warn('SW registration failed:', err))
    })
  } else {
    // Dev or non-http(s) (e.g. Electron file://): ensure no stale SW from
    // a prior production visit lingers.
    navigator.serviceWorker
      .getRegistrations()
      .then((regs) => regs.forEach((r) => r.unregister()))
      .catch(() => {})
  }
}
