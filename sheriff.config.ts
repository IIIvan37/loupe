import { type SheriffConfig, sameTag } from '@softarc/sheriff-core'

/**
 * Hexagonal boundaries + emergent feature modules, verified on the real module
 * graph (see docs/adr/0005-modules-emergents.md).
 *
 * Two tag dimensions:
 *   - `layer:*`  — the hexagon (domain ← application ← api ← web adapter)
 *   - `feature:*`— the module a file belongs to, matched by the DORMANT
 *     placeholder rules below: creating `core/src/<name>/domain` is all it
 *     takes, no config edit. Extraction = one `git mv`.
 *
 * The nursery (`core/src/domain`, `core/src/application`, flat files) is where
 * concepts are born before a module is apparent. Rules encode the ratchet:
 * the nursery may use features and `shared`, but a feature may NEVER import
 * the nursery — extraction only increases structure.
 *
 * What Sheriff cannot see stays with Biome (browser globals / Node builtins
 * inside the pure core, fakes banned from web production code) and with the
 * fitness functions (purity.spec.ts, public-surface.spec.ts).
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
    // The kernel: grows by promotion only (second consumer), never creation.
    // Dormant until the first promotion (median, nearest-time, timecode are
    // the expected ones).
    'packages/core/src/shared': ['shared'],
    // The nurseries (flat newborn files).
    'packages/core/src/domain': ['nursery', 'layer:domain'],
    'packages/core/src/application': ['nursery', 'layer:application'],
    // DORMANT placeholders: any core/src/<feature>/{domain,application,testing}
    // folder is tagged the moment it exists.
    'packages/core/src/<feature>/domain': ['feature:<feature>', 'layer:domain'],
    'packages/core/src/<feature>/application': [
      'feature:<feature>',
      'layer:application'
    ],
    'packages/core/src/<feature>/testing': [
      'feature:<feature>',
      'layer:testing'
    ],
    // The @app/core/testing barrel: fakes + port contracts of still-in-nursery
    // ports, re-exporting each feature's test kit once modules exist.
    'packages/core/src/testing': ['core:testing'],
    // The public contract (index.ts).
    'packages/core/src': ['core:api'],
    'packages/web/src': ['web']
  },
  depRules: {
    root: 'noTag',
    noTag: 'noTag',

    // The kernel depends on nothing but itself.
    shared: ['shared'],

    // The hexagon, per layer (holds inside features and nurseries alike).
    'layer:domain': ['layer:domain', 'shared'],
    'layer:application': ['layer:application', 'layer:domain', 'shared'],
    'layer:testing': [
      'layer:testing',
      'layer:application',
      'layer:domain',
      'shared'
    ],

    // Feature isolation: a feature sees itself and the kernel. A REAL
    // inter-feature dependency is one explicit line here (e.g.
    // `'feature:structure': [sameTag, 'shared', 'feature:harmony']`),
    // visible in review. The nursery carries no feature tag, so a feature
    // importing the nursery violates this rule — that is the ratchet.
    'feature:*': [sameTag, 'shared'],

    // The nursery may use the kernel, itself, and any already-extracted
    // feature (downward only — the reverse is the ratchet above).
    nursery: ['nursery', 'shared', 'feature:*'],

    // The public contract re-exports features, nursery use-cases and kernel.
    'core:api': ['feature:*', 'nursery', 'shared'],
    // The testing barrel re-exports each feature's test kit — and the fakes of
    // still-in-nursery ports, which live directly in core/src/testing until
    // their module is extracted. Nothing may depend on it: no rule below ever
    // grants 'core:testing'.
    'core:testing': ['feature:*', 'nursery', 'shared'],
    // The web adapter consumes only the core's public contract. Its SPECS also
    // replay the port contracts from @app/core/testing — invisible to Sheriff;
    // the production-code ban is Biome's override on packages/web.
    web: ['core:api']
  }
}
