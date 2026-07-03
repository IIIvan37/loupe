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
  server: {
    port: 5173
  }
})
