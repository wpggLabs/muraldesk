// Preload runs before the renderer starts and is the only place where
// Node-style APIs would be exposed to the page via contextBridge.
//
// MuralDesk currently runs entirely in the browser context with
// localStorage + IndexedDB and does not need any native APIs, so this
// preload intentionally does nothing. It exists so that contextIsolation
// stays on and a future bridge can be added here without touching the
// main process.
