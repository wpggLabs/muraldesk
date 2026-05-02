import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// `base: './'` makes Vite emit relative asset paths in the built
// index.html. That matters for the Electron desktop target, which loads
// the production build via `file://` — absolute paths like `/assets/...`
// would resolve to `file:///assets/...` and 404. Relative paths also work
// fine for the web/PWA build, so we use them in both targets.
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5000,
    allowedHosts: true,
  },
})
