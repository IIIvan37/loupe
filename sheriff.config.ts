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
    web: 'packages/web/src/main.tsx',
    // Sheriff only walks the graph from entry points and *.spec.ts files are
    // invisible to it — adapter SPECS are the testing barrel's only consumers,
    // so without this entry point the whole testing subtree (and every rule
    // about it) would go unverified.
    'core-testing': 'packages/core/src/testing/index.ts'
  },
  enableBarrelLess: true,
  modules: {
    'packages/core/src/domain': ['core:domain'],
    'packages/core/src/application': ['core:application'],
    // Fakes + port contracts served by the @app/core/testing subpath.
    'packages/core/src/testing': ['core:testing'],
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
    // Fakes implement ports (application) over domain values — and nothing
    // may depend on them: no rule below ever grants 'core:testing'.
    'core:testing': ['core:domain', 'core:application'],
    // The public contract (index.ts) re-exports domain + application.
    'core:api': ['core:domain', 'core:application'],
    // Adapters consume only the core's public contract. Their SPECS also
    // replay the port contracts from @app/core/testing — invisible to Sheriff;
    // the production-code ban is Biome's override on packages/web.
    web: ['core:api']
  }
}
