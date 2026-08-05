import { lingui } from '@lingui/vite-plugin'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

/**
 * The server shell resolves its backend from `window.location.origin`
 * (create-project-stores, create-track-source, the presence heartbeat) — in
 * production the page IS served by the loupe binary. In dev, `pnpm dev:full`
 * runs Vite with VITE_SHELL=server and proxies the binary's routes to a
 * locally running `loupe-server` (default port 6173), so the full product —
 * projects, URL import, heartbeat — iterates with HMR instead of requiring a
 * `vite build` per change.
 */
const SERVER_ROUTES = [
  '/projects',
  '/audio',
  '/download',
  '/heartbeat',
  '/health',
  '/version',
  '/gc'
]

const serverShellProxy =
  process.env.VITE_SHELL === 'server'
    ? Object.fromEntries(
        SERVER_ROUTES.map((route) => [
          route,
          { target: 'http://127.0.0.1:6173', changeOrigin: true }
        ])
      )
    : undefined

export default defineConfig({
  plugins: [
    // The macro plugin turns t()/msg()/<Trans> into plain runtime calls;
    // the lingui plugin compiles .po catalogs on import (no generated files).
    react({ babel: { plugins: ['@lingui/babel-plugin-lingui-macro'] } }),
    lingui()
  ],
  resolve: {
    // Root alias for cross-folder CSS `composes` paths (ADR 0013): a module's
    // depth must not encode into its neighbours' stylesheets — CSS breakage
    // has no typecheck to catch it. TS imports stay relative on purpose.
    alias: { '@': new URL('./src', import.meta.url).pathname }
  },
  server: {
    port: 5173,
    ...(serverShellProxy && { proxy: serverShellProxy })
  }
})
