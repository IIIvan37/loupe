import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Design fitness function for CLOSED VARIANT SETS (revue SOLID 2026-08-04,
 * constats OCP n° 1–3 — the shotgun-surgery family the compiler cannot see
 * on its own). Three rules over core AND web production sources:
 *
 * 1. **Closed vocabulary.** A registered literal set (transport error codes,
 *    separation phases) is SPELLED OUT in one owner module; any other file
 *    quoting the whole set is a re-declaration waiting to drift — compose the
 *    owner's type instead. Record keys stay unquoted, so exhaustive copy
 *    tables never trip this.
 * 2. **Wired reducer actions.** Every action variant of a reducer the core
 *    exports must have a dispatch site in web — a variant no adapter sends is
 *    dead policy (the `tick` case removed by PR #361, the `toggle` case this
 *    spec flushed out at birth). The literals are extracted from the union
 *    itself, so this list can never go stale.
 * 3. **No hand-written membership chains.** `x === 'a' || x === 'b' || …`
 *    (3+ literals) re-enumerates a union outside the compiler's sight — a new
 *    variant compiles clean and the chain silently misses it (the analyser
 *    row's `running`, constat n° 2). Derive from a `Record<Union, …>` table
 *    or a core predicate (`isSeparationPhase`) instead. Pinned at 0.
 */

interface Vocabulary {
  readonly name: string
  readonly literals: readonly string[]
  /** The one module allowed to spell the whole set (path suffix). */
  readonly owner: string
  /** Sorted path suffixes where full co-quotation is justified — each entry
   * must stay compiler-tied to the owner's type (say how in the comment). */
  readonly allowed: readonly string[]
}

const VOCABULARIES: readonly Vocabulary[] = [
  {
    name: 'analysis transport error codes',
    literals: ['engine-unavailable', 'network', 'timeout', 'too-large'],
    owner: 'core/src/shared/analysis-transport.ts',
    allowed: [
      // The HTTP-status interpretation: its values are typed
      // AnalysisTransportErrorCode, so a drifted literal is a compile error.
      'web/src/audio/http/post-wav-json.ts'
    ]
  },
  {
    name: 'separation phases',
    literals: ['analysing', 'separating', 'retrieving'],
    owner: 'core/src/separation/domain/separation.ts',
    allowed: []
  }
]

/** Reducers the core exports: every variant of their action union must be
 * dispatched somewhere in web (file paths relative to this directory). */
const WIRED_REDUCERS = [
  { name: 'transportReducer', file: 'domain/transport.ts' },
  { name: 'mixerReducer', file: 'separation/domain/mixer.ts' },
  { name: 'separationReducer', file: 'separation/domain/separation.ts' }
] as const

/** 3+ same-subject literal equality chain — spanning lines. */
const MEMBERSHIP_CHAIN =
  /([\w.]+)\s*===\s*'[^']+'(?:\s*\|\|\s*\1\s*===\s*'[^']+'){2,}/g

/** Blank comments, keeping line numbers — prose may quote a literal set. */
function codeOnly(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' '))
    .split('\n')
    .map((line) => (/^\s*(\/\/|\*)/.test(line) ? '' : line))
    .join('\n')
}

function quotesWholeSet(source: string, literals: readonly string[]): boolean {
  const code = codeOnly(source)
  return literals.every((literal) => code.includes(`'${literal}'`))
}

/** The `type: '…'` literals of a file's action union (and only a union file's
 * own dispatches, which core reducers do not contain). */
function actionLiterals(source: string): readonly string[] {
  return [...codeOnly(source).matchAll(/type: '([\w-]+)'/g)].map(
    (match) => match[1] as string
  )
}

function membershipChains(source: string, path: string): readonly string[] {
  return [...codeOnly(source).matchAll(MEMBERSHIP_CHAIN)].map(
    (match) => `  ${path} — ${match[0].replace(/\s+/g, ' ').slice(0, 100)}`
  )
}

/** Production `.ts`/`.tsx` under a root: no specs, no ambient declarations. */
function productionSources(dir: string): readonly string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      return productionSources(path)
    }
    if (
      /\.tsx?$/.test(entry.name) &&
      !/\.spec\.tsx?$|\.d\.ts$/.test(entry.name)
    ) {
      return [path]
    }
    return []
  })
}

const coreRoot = fileURLToPath(new URL('.', import.meta.url))
const webRoot = fileURLToPath(new URL('../../web/src', import.meta.url))
const normalized = (path: string): string => path.replaceAll('\\', '/')

describe('the detectors themselves', () => {
  it('sees a whole set quoted, ignoring comments and record keys', () => {
    expect(
      quotesWholeSet("type X = 'a' | 'b'\nconst t = { a: 1, b: 2 }", ['a', 'b'])
    ).toBe(true)
    expect(
      quotesWholeSet("// the set 'a' | 'b'\nconst x = 'a'", ['a', 'b'])
    ).toBe(false)
  })

  it('extracts action literals from a union declaration', () => {
    expect(
      actionLiterals(
        "| { readonly type: 'play' }\n| { readonly type: 'no-op' }"
      )
    ).toEqual(['play', 'no-op'])
  })

  it.each([
    "s === 'a' || s === 'b' || s === 'c'",
    "sep.status === 'x' ||\n  sep.status === 'y' ||\n  sep.status === 'z'"
  ])('flags the 3-literal chain %j', (source) => {
    expect(membershipChains(source, 'x.ts')).toHaveLength(1)
  })

  it.each([
    "s === 'a' || s === 'b'",
    "a === 'x' || b === 'y' || c === 'z'",
    "// s === 'a' || s === 'b' || s === 'c'"
  ])('leaves %j alone (two literals, mixed subjects, prose)', (source) => {
    expect(membershipChains(source, 'x.ts')).toEqual([])
  })
})

describe('variant discipline over core and web production sources', () => {
  const sources = [
    ...productionSources(coreRoot),
    ...productionSources(webRoot)
  ]

  it('finds sources to scan (a silent empty scan proves nothing)', () => {
    expect(sources.length).toBeGreaterThan(100)
  })

  it.each(VOCABULARIES)(
    'keeps the $name spelled out only by their owner',
    ({ literals, owner, allowed }) => {
      const offenders = sources
        .filter((path) => {
          const p = normalized(path)
          return ![owner, ...allowed].some((suffix) => p.endsWith(suffix))
        })
        .filter((path) => quotesWholeSet(readFileSync(path, 'utf8'), literals))
      expect(
        offenders,
        `\nthe whole set [${literals.join(', ')}] is re-spelled outside ${owner}:` +
          `\n${offenders.map((o) => `  ${o}`).join('\n')}` +
          `\nCompose the owner's exported type instead of re-declaring the union.`
      ).toEqual([])
    }
  )

  it.each(WIRED_REDUCERS)(
    'finds a web dispatch for every $name action variant',
    ({ file }) => {
      const literals = actionLiterals(
        readFileSync(join(coreRoot, file), 'utf8')
      )
      expect(
        literals.length,
        'the union extraction came back empty'
      ).toBeGreaterThan(0)
      const web = productionSources(webRoot).map((path) =>
        codeOnly(readFileSync(path, 'utf8'))
      )
      const dead = literals.filter(
        (literal) =>
          !web.some((source) => source.includes(`type: '${literal}'`))
      )
      expect(
        dead,
        `\naction variant(s) of ${file} never dispatched in web: ${dead.join(', ')}.` +
          `\nA variant no adapter sends is dead policy — wire it or delete it.`
      ).toEqual([])
    }
  )

  it('never hand-writes a 3-literal membership chain (derive from the union)', () => {
    const chains = sources.flatMap((path) =>
      membershipChains(readFileSync(path, 'utf8'), path)
    )
    expect(
      chains,
      `\nhand-written membership chain(s) — a new variant compiles clean and is` +
        `\nsilently missed; use a Record<Union, …> table or a core predicate:` +
        `\n${chains.join('\n')}`
    ).toEqual([])
  })
})
