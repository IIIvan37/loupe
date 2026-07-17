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
    // The suite has grown to ~120 files; the shell integration specs (two
    // imports + a project restore) take 0.3–0.5 s alone but can cross the
    // 5 s default under full parallel load with coverage — load-flakes, not
    // hangs. 15 s keeps real hangs visible without failing on contention.
    testTimeout: 15_000,
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
        '**/*.d.ts',
        // Browser-runtime humble objects and composition roots: they touch Web
        // Audio (AudioContext / AudioWorklet / decodeAudioData) or trigger a
        // browser download — none of which jsdom can drive. Verified in a real
        // browser, not by unit tests, so they are kept out of the coverage metric
        // rather than dragging it down with unreachable lines.
        '**/audio/count-in-player.ts',
        '**/audio/web-audio-playback.ts',
        '**/audio/web-audio-stem-playback.ts',
        '**/audio/web-audio-shared.ts',
        '**/audio/web-audio-decoder.ts',
        '**/audio/resample-mono.ts',
        '**/audio/download-blob.ts',
        '**/audio/analysis-endpoint.ts',
        '**/audio/warm-up-analysis.ts',
        '**/audio/create-chord-detector.ts',
        '**/audio/create-separator.ts',
        '**/audio/create-structure-detector.ts',
        '**/audio/create-tempo-detector.ts',
        '**/audio/create-track-source.ts',
        '**/audio/music-metadata-reader.ts',
        // Humble Tauri binding: forwards `ProjectFs` calls to the plugin under
        // app-data; only reachable inside the shell, verified there for real.
        '**/projects/tauri-fs.ts'
      ],
      // TDD strict: the pure core stays fully covered; the web adapters/UI are
      // exercised through component/integration tests. Both are gated (the
      // untestable Web Audio adapters above are excluded, not tolerated).
      thresholds: {
        'packages/core/src/**': {
          statements: 90,
          branches: 85,
          functions: 90,
          lines: 90
        },
        'packages/web/src/**': {
          statements: 85,
          branches: 80,
          functions: 85,
          lines: 85
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
