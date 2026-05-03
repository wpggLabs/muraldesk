import { useCallback, useEffect, useLayoutEffect, useState } from 'react'

// Theme preference. Lives in its own localStorage key so it is fully
// independent of the layout (`muraldesk-board`), snap (`muraldesk-snap`),
// and view (`muraldesk-view`) keys. None of those modules read or write
// this key and this hook never reads or writes any of theirs.
//
// Stored as a single JSON-serialized object so a future addition (e.g.
// a custom hue, a font-size scale) doesn't require a new key.
const STORAGE_KEY = 'muraldesk-theme'

// Allowed values. Exported so consumers can validate at the edges
// (Toolbar pills) without re-typing the literals.
export const THEME_MODES = ['dark', 'light', 'system']
export const ACCENTS = ['purple', 'blue', 'green', 'orange']

// Default = current dark / purple look. Matches the values defined in
// `:root` of src/index.css, so users who never touch the theme picker
// see exactly the pre-feature visuals (and, importantly, the very first
// paint before this hook's effect runs is already correct because the
// CSS defaults equal the resolved-for-default-user values).
const DEFAULT_THEME = Object.freeze({ mode: 'dark', accent: 'purple' })

function loadTheme() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_THEME }
    const parsed = JSON.parse(raw)
    return {
      mode: THEME_MODES.includes(parsed && parsed.mode) ? parsed.mode : DEFAULT_THEME.mode,
      accent: ACCENTS.includes(parsed && parsed.accent) ? parsed.accent : DEFAULT_THEME.accent,
    }
  } catch {
    // localStorage can throw in private mode / sandboxed iframes, and
    // JSON.parse can throw on a corrupted value. Fall back to defaults
    // (dark + purple) so the user always gets a coherent theme.
    return { ...DEFAULT_THEME }
  }
}

function saveTheme(t) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(t))
  } catch {
    // Same reason as loadTheme — silently no-op on quota / sandbox
    // failures. The setting will simply not persist this session.
  }
}

function systemPrefersDark() {
  if (typeof window === 'undefined' || !window.matchMedia) return true
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

// Single hook that owns the theme state, persistence, the OS-prefs
// listener (for `mode === 'system'`), and the synchronous DOM apply.
// Returns:
//   - mode           'dark' | 'light' | 'system' (the user's choice)
//   - accent         'purple' | 'blue' | 'green' | 'orange'
//   - effectiveMode  'dark' | 'light' (mode after resolving 'system')
//   - setMode / setAccent / cycleMode / cycleAccent
export function useTheme() {
  const [theme, setTheme] = useState(loadTheme)
  const [systemDark, setSystemDark] = useState(systemPrefersDark)

  // Track prefers-color-scheme so 'system' mode flips live when the OS
  // theme changes (e.g. macOS sunset auto-dark-mode). We use both the
  // modern `addEventListener` and the legacy `addListener` API so this
  // works on older Safari builds without throwing.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (e) => setSystemDark(e.matches)
    if (mql.addEventListener) mql.addEventListener('change', onChange)
    else if (mql.addListener) mql.addListener(onChange)
    return () => {
      if (mql.removeEventListener) mql.removeEventListener('change', onChange)
      else if (mql.removeListener) mql.removeListener(onChange)
    }
  }, [])

  const effectiveMode = theme.mode === 'system'
    ? (systemDark ? 'dark' : 'light')
    : theme.mode

  // Apply data-theme + data-accent on <html> SYNCHRONOUSLY before paint
  // (useLayoutEffect, not useEffect) so users with a non-default saved
  // theme don't see a one-frame flash of the default dark/purple paint
  // before the override kicks in. For default-theme users the CSS
  // `:root` defaults already match the resolved values, so there is no
  // flash either way.
  useLayoutEffect(() => {
    const html = document.documentElement
    html.setAttribute('data-theme', effectiveMode)
    html.setAttribute('data-accent', theme.accent)
  }, [effectiveMode, theme.accent])

  useEffect(() => {
    saveTheme(theme)
  }, [theme])

  const setMode = useCallback((next) => {
    if (!THEME_MODES.includes(next)) return
    setTheme((prev) => (prev.mode === next ? prev : { ...prev, mode: next }))
  }, [])

  const setAccent = useCallback((next) => {
    if (!ACCENTS.includes(next)) return
    setTheme((prev) => (prev.accent === next ? prev : { ...prev, accent: next }))
  }, [])

  const cycleMode = useCallback(() => {
    setTheme((prev) => {
      const idx = THEME_MODES.indexOf(prev.mode)
      const next = THEME_MODES[((idx === -1 ? 0 : idx) + 1) % THEME_MODES.length]
      return { ...prev, mode: next }
    })
  }, [])

  const cycleAccent = useCallback(() => {
    setTheme((prev) => {
      const idx = ACCENTS.indexOf(prev.accent)
      const next = ACCENTS[((idx === -1 ? 0 : idx) + 1) % ACCENTS.length]
      return { ...prev, accent: next }
    })
  }, [])

  return {
    mode: theme.mode,
    accent: theme.accent,
    effectiveMode,
    setMode,
    setAccent,
    cycleMode,
    cycleAccent,
  }
}
