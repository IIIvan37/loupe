import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Architecture fitness function: every VALUE the core exports from its public
 * surface (`src/index.ts`) must have at least one consumer outside the core.
 *
 * Why this exists: knip cannot see this — `index.ts` is the package entry, so
 * an export nothing consumes is invisible to it. "You are the check" was the
 * previous arrangement, and hand-held checks are the ones that fail. Hyrum's
 * Law is the stake: every export becomes a behavior someone may depend on, and
 * can then never be retracted — a minimal surface is the only one that can
 * still evolve.
 *
 * Scope: VALUE exports only (`export { x }`). Type-only exports are consumed
 * structurally (an adapter can satisfy `PlaybackEngine` without ever naming
 * it), so a lexical check would cry wolf — they stay a review concern.
 */

const CORE_SRC = fileURLToPath(new URL('.', import.meta.url))
const WORKSPACE = resolve(CORE_SRC, '../../..')

/** Blank out comments: whole-line `//` ones, and block comments. */
function blankComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n')
    .map((line) => (/^\s*\/\//.test(line) ? '' : line))
    .join('\n')
}

/**
 * Everything in a barrel source that the orphan check below cannot read.
 *
 * `valueExportsOf` is lexical, so it is only sound if the surface file sticks
 * to the one grammar it parses: named `export [type] { … } from` clauses,
 * comments, blanks. An `export *`, a default export or a value defined inline
 * would be public yet invisible — the check would pass while guarding nothing.
 * This closes that fail-open hole by rejecting the forms, not parsing them.
 */
function barrelViolationsOf(source: string): readonly string[] {
  return blankComments(source)
    .replace(/export\s+(?:type\s+)?\{[^}]*\}\s+from\s+'[^']*'/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && !/^export\s*\{\s*\}$/.test(line))
}

/** Named VALUE exports of a barrel: `export { a, b } from …` (not `export type`). */
function valueExportsOf(source: string): readonly string[] {
  const clauses = blankComments(source).matchAll(/export\s+\{([^}]*)\}\s+from/g)
  return [...clauses].flatMap(([, names]) =>
    (names ?? '')
      .split(',')
      .map((n) => n.trim())
      .filter((n) => n !== '' && !n.startsWith('type '))
      .map((n) => n.split(/\s+as\s+/)[0] ?? n)
  )
}

/** True when `name` is imported from `@app/core` somewhere in `source`. */
function importsFromCore(source: string, name: string): boolean {
  const imports = source.matchAll(
    /import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+'@app\/core'/g
  )
  return [...imports].some(([, names]) =>
    (names ?? '')
      .split(',')
      .map((n) => n.trim().replace(/^type\s+/, ''))
      .some((n) => (n.split(/\s+as\s+/)[0] ?? n) === name)
  )
}

/**
 * Every production .ts/.tsx file of every non-core package. In this repo the
 * consumers are `packages/web/src` (React adapter, so .tsx counts) and any
 * future adapter package that grows a `src/` (packages/desktop is a Tauri
 * shell with no TypeScript today — the guard skips it until it has some).
 */
function outsideCoreSources(): readonly string[] {
  const packagesDir = join(WORKSPACE, 'packages')
  return readdirSync(packagesDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name !== 'core')
    .map((pkg) => join(packagesDir, pkg.name, 'src'))
    .filter((src) => existsSync(src))
    .flatMap((src) => walk(src))
}

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      return walk(path)
    }
    const isSource = entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')
    const isSpec =
      entry.name.endsWith('.spec.ts') || entry.name.endsWith('.spec.tsx')
    return isSource && !isSpec ? [path] : []
  })
}

describe('the detector itself', () => {
  it.each([
    ["export * from './domain/beat-grid.ts'", 'a wildcard hides every name'],
    ['export function helper() {}', 'a value defined in the barrel itself'],
    ['export default detectMeter', 'a default export has no importable name'],
    [
      "import { detectMeter } from './domain/beat-grid.ts'",
      'a barrel re-exports, it does not import'
    ]
  ])('rejects %j (%s)', (line) => {
    expect(barrelViolationsOf(line)).toHaveLength(1)
  })

  it('accepts the empty-module marker `export {}` (an empty surface)', () => {
    expect(barrelViolationsOf('export {}')).toEqual([])
  })

  it('accepts the full grammar: comments, export {} from, export type {} from', () => {
    const source = [
      '// a comment',
      '/* a block',
      '   comment */',
      "export { detectMeter } from './a.ts'",
      'export type {',
      '  Beat,',
      '  BeatGrid',
      "} from './a.ts'",
      ''
    ].join('\n')
    expect(barrelViolationsOf(source)).toEqual([])
  })

  it('finds value exports and skips type-only ones', () => {
    const source = [
      "export { detectMeter } from './a.ts'",
      "export type { Beat, BeatGrid } from './a.ts'",
      "export { foldTempoOctave, type Inline } from './b.ts'"
    ].join('\n')
    expect(valueExportsOf(source)).toEqual(['detectMeter', 'foldTempoOctave'])
  })

  it('sees a named import from @app/core', () => {
    expect(
      importsFromCore("import { detectMeter } from '@app/core'", 'detectMeter')
    ).toBe(true)
  })

  it('sees a multi-line import with inline type specifiers', () => {
    const source = [
      'import {',
      '  type BeatGrid,',
      '  detectMeter,',
      '  foldTempoOctave',
      "} from '@app/core'"
    ].join('\n')
    expect(importsFromCore(source, 'foldTempoOctave')).toBe(true)
  })

  it('does not confuse a substring for a consumer', () => {
    expect(
      importsFromCore(
        "import { detectMeterAgain } from '@app/core'",
        'detectMeter'
      )
    ).toBe(false)
  })

  it('ignores imports from other specifiers', () => {
    expect(
      importsFromCore(
        "import { detectMeter } from '@app/core/testing'",
        'detectMeter'
      )
    ).toBe(false)
  })

  it('scans .tsx consumers too (the web adapter is React)', () => {
    const tsx = outsideCoreSources().filter((p) => p.endsWith('.tsx'))
    expect(tsx.length).toBeGreaterThan(0)
  })

  it('never reads an adapter spec as a consumer', () => {
    // An export imported only by an adapter SPEC has no production consumer —
    // counting it would let a test justify public surface. Hyrum's Law does
    // not care that the dependant is a test file.
    const specs = outsideCoreSources().filter(
      (p) => p.endsWith('.spec.ts') || p.endsWith('.spec.tsx')
    )
    expect(specs).toEqual([])
  })

  it('does not count a namespace import as a consumer — on purpose', () => {
    // `import * as core` depends on everything and therefore justifies
    // nothing: it would mark every export consumed and disarm the orphan
    // check. Failing closed is the point — name what you consume.
    expect(
      importsFromCore("import * as core from '@app/core'", 'detectMeter')
    ).toBe(false)
  })
})

describe('the core public surface is consumer-justified', () => {
  const surface = readFileSync(join(CORE_SRC, 'index.ts'), 'utf8')
  const exported = valueExportsOf(surface)
  const consumers = outsideCoreSources().map((p) => readFileSync(p, 'utf8'))

  it('sticks to the grammar the orphan check can read', () => {
    expect(
      barrelViolationsOf(surface),
      '\ncore/src/index.ts contains a form the orphan check below cannot' +
        '\nparse (export *, a default export, an inline value, an import).' +
        '\nSuch an export would be public yet unchecked — rewrite it as a' +
        "\nnamed `export { … } from '…'` clause."
    ).toEqual([])
  })

  // One test over the whole list, not it.each: an EMPTY surface is legitimate,
  // and vitest fails a suite that generates zero tests. The detector's own
  // tests above are what keep the regexes honest, not a floor on the count.
  it('every value export is imported somewhere outside the core', () => {
    const orphans = exported.filter(
      (name) => !consumers.some((source) => importsFromCore(source, name))
    )
    expect(
      orphans,
      `\nExported from core/src/index.ts but imported by no adapter: ` +
        `${orphans.join(', ')}.` +
        '\nName the consumer or remove the export (a supplier without a' +
        '\nconsumer is the speculation invariant #2 forbids).'
    ).toEqual([])
  })
})
