import { lingui } from '@lingui/vite-plugin'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

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
    port: 5173
  }
})
