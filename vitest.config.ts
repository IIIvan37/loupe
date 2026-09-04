import { availableParallelism } from 'node:os'
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
    // Vitest sizes its pool from the logical core count. Under WSL2 those cores
    // are shared with the Windows host, so a full-width `test:coverage` run
    // (v8 instrumentation on top) starves the box — measured at load ~50 on 14
    // cores, with shell specs timing out on CONTENTION, not on a real hang. It
    // reproduced on a clean tree, so it is the harness, not any one change.
    //
    // HALF the cores, not a third (2026-09-04, 14 logical cores, 2607 tests):
    // a third (4 workers) ran the covered suite in 115 s, half (7) in 92 s and
    // 94 s on two consecutive fully-green runs. The instrumentation is what is
    // CPU-bound — the bare suite barely moves (81 s → 79 s), because its ~80 s
    // floor is per-file setup: ~127 s CPU of jsdom `environment` and ~88 s of
    // `import`. Going wider stops paying and starts costing: 12 workers gave
    // 96 s AND a red test. So half is the measured optimum, not a step towards
    // full width. CI runners are small and already green at full width, so
    // they keep the default.
    // (Spread, not `maxWorkers: undefined` — exactOptionalPropertyTypes.)
    ...(process.env.CI
      ? {}
      : { maxWorkers: Math.max(2, Math.floor(availableParallelism() / 2)) }),
    // Node by default (the pure core). Web specs opt into jsdom per-file via a
    // `// @vitest-environment jsdom` docblock.
    environment: 'node',
    // Silences jsdom's "Not implemented: getContext()" noise (see the file).
    setupFiles: ['./vitest.setup.ts'],
    include: [
      'packages/*/src/**/*.spec.ts',
      'packages/*/src/**/*.spec.tsx',
      'docs/**/*.spec.ts'
    ],
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
        // rather than dragging it down with unreachable lines. (8 stale globs
        // purged 2026-08-01: #323 moved the files under audio/playback|http|
        // encode, the entries matched nothing and the thresholds pass with
        // those files counted — an exclusion that excludes nothing only lies.)
        '**/audio/download-blob.ts',
        '**/audio/create-chord-detector.ts',
        '**/audio/create-separator.ts',
        '**/audio/create-structure-detector.ts',
        '**/audio/create-tempo-detector.ts',
        '**/audio/create-track-source.ts',
        '**/audio/music-metadata-reader.ts'
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
    // Array form on purpose: '@app/core' alone would prefix-match
    // '@app/core/testing' and mangle it into 'index.ts/testing' — the
    // subpath entry must come first.
    alias: [
      {
        find: '@app/core/testing',
        replacement: new URL(
          './packages/core/src/testing/index.ts',
          import.meta.url
        ).pathname
      },
      {
        find: '@app/core',
        replacement: new URL('./packages/core/src/index.ts', import.meta.url)
          .pathname
      }
    ]
  }
})
