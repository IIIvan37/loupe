import { defineConfig } from 'vitest/config'

export default defineConfig({
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
