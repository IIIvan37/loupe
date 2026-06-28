import type { SheriffConfig } from '@softarc/sheriff-core'

/**
 * Hexagonal boundaries, verified on the real module graph. The two invariants
 * Sheriff can't see (browser globals + Node builtins inside the pure core) are
 * held by Biome (noRestrictedGlobals / noRestrictedImports, override on
 * packages/core in biome.json).
 *
 *   domain  ← application  ← api (index.ts)  ← web adapter
 *
 * The domain is the center and depends on nothing. Add another adapter as an
 * extra entry point + module + depRule when you grow the workspace.
 */
export const config: SheriffConfig = {
  entryPoints: {
    web: 'packages/web/src/main.tsx'
  },
  enableBarrelLess: true,
  modules: {
    'packages/core/src/domain': ['core:domain'],
    'packages/core/src/application': ['core:application'],
    'packages/core/src': ['core:api'],
    'packages/web/src': ['web']
  },
  depRules: {
    root: 'noTag',
    noTag: 'noTag',

    // The domain is the center: it depends on no other layer.
    'core:domain': [],
    // Orchestration sees only the domain.
    'core:application': ['core:domain'],
    // The public contract (index.ts) re-exports domain + application.
    'core:api': ['core:domain', 'core:application'],
    // Adapters consume only the core's public contract.
    web: ['core:api']
  }
}
