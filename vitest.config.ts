import { type PluginItem, transformAsync } from '@babel/core'
import linguiMacroPlugin from '@lingui/babel-plugin-lingui-macro'
import { getConfig } from '@lingui/conf'
import { lingui } from '@lingui/vite-plugin'
import { defineConfig, type Plugin } from 'vitest/config'

/**
 * Strip Lingui macros the same way the web build does. The web app relies on
 * @vitejs/plugin-react's babel pass (see packages/web/vite.config.ts), which
 * does not transform files under Vitest's module runner — so specs get their
 * own minimal pass: parse TS/JSX, apply only the macro plugin, keep the rest.
 */
const linguiConfig = getConfig({
  configPath: 'packages/web/lingui.config.ts'
})

// The macro plugin's published signature is narrower than babel's
// PluginTarget; the runtime shape is a regular babel plugin.
const linguiMacroBabelPass = [
  linguiMacroPlugin,
  { linguiConfig }
] as unknown as PluginItem

const linguiMacrosForTests: Plugin = {
  name: 'lingui-macros-for-tests',
  enforce: 'pre',
  async transform(code: string, id: string) {
    if (!id.includes('packages/web/src') || !code.includes('/macro')) {
      return null
    }
    const result = await transformAsync(code, {
      configFile: false,
      babelrc: false,
      filename: id,
      parserOpts: { plugins: ['typescript', 'jsx'] },
      plugins: [linguiMacroBabelPass],
      sourceMaps: true
    })
    return result?.code
      ? // Serialised so it fits Vite's SourceMapInput without type juggling.
        {
          code: result.code,
          map: result.map ? JSON.stringify(result.map) : null
        }
      : null
  }
}

export default defineConfig({
  plugins: [
    linguiMacrosForTests,
    // Compiles the .po catalog on import, same as the web build.
    lingui({ configPath: 'packages/web/lingui.config.ts' })
  ],
  test: {
    globals: true,
    // Node by default (the pure core). Web specs opt into jsdom per-file via a
    // `// @vitest-environment jsdom` docblock.
    environment: 'node',
    // Silences jsdom's "Not implemented: getContext()" noise (see the file).
    setupFiles: ['./vitest.setup.ts'],
    include: ['packages/*/src/**/*.spec.ts', 'packages/*/src/**/*.spec.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['packages/*/src/**/*.{ts,tsx}'],
      exclude: [
        '**/*.spec.ts',
        '**/*.spec.tsx',
        '**/index.ts',
        '**/main.ts',
        '**/main.tsx',
        '**/*.d.ts'
      ],
      // TDD strict: the pure core is meant to stay fully covered. Thresholds gate
      // `core` only; web adapters are exercised through component/integration tests.
      thresholds: {
        'packages/core/src/**': {
          statements: 90,
          branches: 85,
          functions: 90,
          lines: 90
        }
      }
    }
  },
  resolve: {
    alias: {
      '@app/core': new URL('./packages/core/src/index.ts', import.meta.url)
        .pathname
    }
  }
})
