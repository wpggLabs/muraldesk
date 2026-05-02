// Register the service worker only in production builds. In dev we actively
// unregister any previously-installed SW so Vite HMR and the app's persistence
// hydration are never served stale assets from a leftover cache.
export function registerServiceWorker() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return

  if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .catch((err) => console.warn('SW registration failed:', err))
    })
  } else {
    // Dev: ensure no stale SW from a prior production visit lingers.
    navigator.serviceWorker
      .getRegistrations()
      .then((regs) => regs.forEach((r) => r.unregister()))
      .catch(() => {})
  }
}
