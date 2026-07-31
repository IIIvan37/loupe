import { type SheriffConfig, sameTag } from '@softarc/sheriff-core'

// What every web module may always reach: the ui kit and the core's public
// contract (ADR 0012 — the kit never looks up, so granting it broadly is safe).
const WEB_KIT = [
  'web:feature:ui',
  'web:layout',
  'web:lib',
  'web:i18n',
  'core:api'
] as const

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

    // ——— The web adapter's own DAG (docs/adr/0012-graphe-de-modules-web.md).
    // Same mechanism as the core: a DORMANT placeholder tags any app/<feature>
    // folder the moment it exists; a real inter-feature edge is one explicit
    // depRules line, visible in review.
    // The kit (everything may use it, it never looks up).
    'packages/web/src/lib': ['web:lib'],
    'packages/web/src/layout': ['web:layout'],
    'packages/web/src/i18n': ['web:i18n'],
    'packages/web/src/locales': ['web:i18n'],
    // Identity, then the adapters that consume its credentials.
    'packages/web/src/auth': ['web:auth'],
    'packages/web/src/audio': ['web:audio'],
    // Project stores (session signatures read feature defaults).
    'packages/web/src/projects': ['web:projects'],
    // DORMANT placeholder: every app/<feature> folder, including the shell,
    // the session seam and the ui kit — their rules are keyed on their names.
    'packages/web/src/app/<feature>': ['web:feature:<feature>'],
    // The composition root files (main.tsx).
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
    // inter-feature dependency is one explicit line here, visible in review.
    // The nursery carries no feature tag, so a feature importing the nursery
    // violates this rule — that is the ratchet.
    'feature:*': [sameTag, 'shared'],
    // The conceptual DAG, one edge at a time: harmony reads the beat grid
    // (chord-detection folds spans onto it) — rhythm never looks up.
    'feature:harmony': [sameTag, 'shared', 'feature:rhythm'],
    // Loops read the beat grid (snap-loop-region snaps A/B bounds onto it) —
    // rhythm never looks up.
    'feature:loops': [sameTag, 'shared', 'feature:rhythm'],
    // Separation reads the audio primitives (stem-set summarises stems into
    // tracks, waveform-mix combines their waveforms, export-stems encodes
    // WAVs) — audio never looks up.
    'feature:separation': [sameTag, 'shared', 'feature:audio'],
    // Project is the DAG's sink: a manifest persists what the other features
    // model — the loop library and armed A/B region (loops), the beat grid and
    // manual tempo (rhythm), the markers (markers), the stems and mixer
    // (separation). None of them ever looks up at project.
    'feature:project': [
      sameTag,
      'shared',
      'feature:loops',
      'feature:markers',
      'feature:rhythm',
      'feature:separation'
    ],
    // Structure reads chords (chart-structure, form-encoder render sections
    // over the chart) and the beat grid (snapping, measure seeks) — neither
    // ever looks up at structure.
    'feature:structure': [
      sameTag,
      'shared',
      'feature:harmony',
      'feature:rhythm'
    ],

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
    // ——— The web DAG (ADR 0012). Every web module may read the core's public
    // contract and the kit; nothing ever looks up. The web's SPECS also replay
    // the port contracts from @app/core/testing — invisible to Sheriff; the
    // production-code ban is Biome's override on packages/web.

    // The kit, bottom-up.
    'web:lib': ['web:lib', 'core:api'],
    'web:layout': ['web:layout', 'web:lib', 'core:api'],
    'web:i18n': ['web:i18n', 'web:lib', 'core:api'],
    'web:feature:ui': [sameTag, ...WEB_KIT],

    // Identity depends on nothing above the kit; the adapters consume its
    // credentials (analysis token) — never the other way (ADR 0012, cycle 3).
    'web:auth': ['web:auth', 'web:lib', 'core:api'],
    // Adapters implement the session seam's port TYPES (consumer-defined
    // interface — DIP): the audio-session edge is that, and only that.
    'web:audio': [
      'web:audio',
      'web:auth',
      'web:feature:audio-session',
      'web:lib',
      'core:api'
    ],

    // The session seam owns its context and depends on nothing (ADR 0011).
    'web:feature:audio-session': [sameTag, ...WEB_KIT],

    // Feature isolation: a feature sees itself and the kit. A REAL
    // inter-feature edge is one explicit line below, visible in review.
    'web:feature:*': [sameTag, ...WEB_KIT],
    'web:feature:account': [sameTag, ...WEB_KIT, 'web:auth'],
    // The header hosts the import flows (URL track source) and the quota chip.
    'web:feature:header': [
      sameTag,
      ...WEB_KIT,
      'web:feature:audio-session',
      'web:audio'
    ],
    // The lead sheet detects chords (gated analysis).
    'web:feature:lead-sheet': [
      sameTag,
      ...WEB_KIT,
      'web:feature:stems',
      'web:audio',
      'web:auth'
    ],
    // The loops bridge drives the loupe through the ONE player the shell
    // seated (ADR 0011) and snaps drags onto the tempo feature's beat-grid
    // atom (the ADR 0010 read) — neither ever looks up at loops.
    'web:feature:loops': [
      sameTag,
      ...WEB_KIT,
      'web:feature:audio-session',
      'web:feature:tempo'
    ],
    // Structure markers ride the lead-sheet's chart and gate their detection.
    'web:feature:markers': [
      sameTag,
      ...WEB_KIT,
      'web:feature:lead-sheet',
      'web:audio',
      'web:auth'
    ],
    // The mixer reads the stems' colours — and NEVER tempo nor waveform
    // (ADR 0012, cycles 1 & 2: it owns its synthetic lane ids, and the canvas
    // its lanes draw with belongs to the kit). It reaches the session for the
    // ONE stem engine the shell seated (ADR 0011) — a region's bare
    // `useMixer()` must drive the shell's gain graph, never a private one.
    'web:feature:mixer': [
      sameTag,
      ...WEB_KIT,
      'web:feature:audio-session',
      'web:feature:stems'
    ],
    // The separation reaches the session for its separator port and the ONE
    // stem engine's PCM read-back (ADR 0011) — a region's bare `useSeparation()`
    // must see the shell's run, never start a private one.
    'web:feature:separation': [
      sameTag,
      ...WEB_KIT,
      'web:feature:audio-session',
      'web:audio',
      'web:auth'
    ],
    // The metronome and count-in are mixer CLIENTS: they seat stems in the mix
    // (ADR 0012, cycle 1) — the mix never looks up at them.
    'web:feature:tempo': [
      sameTag,
      ...WEB_KIT,
      'web:feature:audio-session',
      'web:feature:mixer',
      'web:audio',
      'web:auth'
    ],
    // The transport reads the stem engine's state to pick its engine (the
    // ADR 0010 atom read — cycle 2's kept direction) and drives the trainer.
    'web:feature:waveform': [
      sameTag,
      ...WEB_KIT,
      'web:feature:audio-session',
      'web:feature:loops',
      'web:feature:mixer',
      'web:audio'
    ],
    // The composition root: seeing every feature is its privilege, the pendant
    // of the 0010 leaves' duty to own their state.
    'web:feature:workstation-shell': [
      sameTag,
      ...WEB_KIT,
      'web:feature:*',
      'web:projects',
      'web:audio',
      'web:auth'
    ],
    // Project stores: dialogs from the kit, session signatures read the
    // metronome's product default (declared oddity — ADR 0012).
    'web:projects': [
      'web:projects',
      ...WEB_KIT,
      'web:feature:tempo',
      'web:lib'
    ],

    // The entry point composes the session seam, the shell and i18n.
    web: [
      'web:feature:audio-session',
      'web:feature:workstation-shell',
      'web:i18n',
      'core:api'
    ]
  }
}
