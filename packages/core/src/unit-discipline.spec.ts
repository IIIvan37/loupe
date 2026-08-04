import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Design fitness function for the branded unit scalars (design review
 * 2026-08-03, défaut n° 2 « aucune quantité n'est typée »). Two rules over
 * every production source of core AND web:
 *
 * 1. **One modulo-12.** The pitch-class wrap lives in `shared/units.ts` and
 *    nowhere else — eight hand-rolled copies is how the rule drifted apart.
 *    A lexical detector cannot see every arithmetic disguise; the deeper
 *    guard is the `PitchClass` brand itself (a hand-rolled wrap yields a
 *    `number` where a `PitchClass` is required). This rule stops the common
 *    spelling at the door.
 *
 * 2. **Name↔type ratchet.** A declaration whose NAME says a unit
 *    (`…Seconds`, `…Db`, …) while its TYPE says bare `number` is a unit the
 *    typechecker cannot defend. Each suffix's count is pinned at the measured
 *    present and only ever descends: above the pin = new untyped quantity
 *    (use the brand); below the pin = stale pin (ratchet it down in the same
 *    PR, like a `sonar-project.properties` exemption naming a moved file).
 */

// ── Ratchet — LOWER as brands are adopted, NEVER raise. ─────────────────────
const NAME_TYPE_PIN: Readonly<Record<string, number>> = {
  Seconds: 74,
  Ratio: 16,
  Db: 7,
  Decibels: 0,
  Cents: 6,
  Percent: 1,
  Pc: 0,
  PitchClass: 0
}

/** The one production file allowed to spell the pitch-class wrap. */
const MOD12_HOME = 'shared/units.ts'

const MOD12 = /%\s*12\b/

/** A unit-suffixed name annotated as bare `number` — longest suffixes first
 * so `…PitchClass` never half-matches as `…Pc`. */
const NAME_TYPE =
  /\b[A-Za-z_$][\w$]*?(PitchClass|Seconds|Decibels|Percent|Cents|Ratio|Db|Pc)\??\s*:\s*number\b/g

/** Blank comments, keeping line numbers — prose may name `% 12`, code may not.
 * Same lexical stance as `purity.spec.ts`: block comments and whole-comment
 * lines only; reword a trailing comment rather than loosening this. */
function codeOnly(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' '))
    .split('\n')
    .map((line) => (/^\s*(\/\/|\*)/.test(line) ? '' : line))
    .join('\n')
}

interface Finding {
  readonly path: string
  readonly line: number
  readonly text: string
}

function findMod12(source: string, path: string): readonly Finding[] {
  return codeOnly(source)
    .split('\n')
    .flatMap((text, index) =>
      MOD12.test(text) ? [{ path, line: index + 1, text: text.trim() }] : []
    )
}

/** Every unit-suffix hit in one source, keyed by suffix. */
function findUntypedUnits(
  source: string,
  path: string
): ReadonlyArray<Finding & { readonly suffix: string }> {
  return codeOnly(source)
    .split('\n')
    .flatMap((text, index) =>
      [...text.matchAll(NAME_TYPE)].map((match) => ({
        path,
        line: index + 1,
        text: text.trim(),
        suffix: match[1] as string
      }))
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

describe('the detectors themselves', () => {
  it.each([
    'const pc = ((midi % 12) + 12) % 12',
    'if (semitones %12 === 0) return note'
  ])('flag the modulo-12 in %j', (source) => {
    expect(findMod12(source, 'x.ts').length).toBeGreaterThan(0)
  })

  it.each([
    'const hour = minutes % 120',
    '// prose may explain the % 12 ban',
    '/* midi % 12 in a block comment */'
  ])('leave %j alone', (source) => {
    expect(findMod12(source, 'x.ts')).toEqual([])
  })

  it('reads a unit-suffixed name typed as bare number, optional included', () => {
    const found = findUntypedUnits(
      'readonly startSeconds: number\nfineTuneCents?: number',
      'x.ts'
    )
    expect(found.map((f) => f.suffix)).toEqual(['Seconds', 'Cents'])
    expect(found[1]?.line).toBe(2)
  })

  it('matches the longest suffix, so …PitchClass is not read as …Pc', () => {
    const [found] = findUntypedUnits('const rootPitchClass: number = 0', 'x.ts')
    expect(found?.suffix).toBe('PitchClass')
  })

  it.each([
    'readonly startSeconds: Seconds',
    'const gainDb: Decibels = channel.gainDb',
    'readonly seconds: number',
    'timeoutMs: number'
  ])('leaves the branded or foreign declaration %j alone', (source) => {
    expect(findUntypedUnits(source, 'x.ts')).toEqual([])
  })
})

describe('unit discipline over core and web production sources', () => {
  const sources = [
    ...productionSources(coreRoot),
    ...productionSources(webRoot)
  ]

  it('finds sources to scan (a silent empty scan proves nothing)', () => {
    expect(sources.length).toBeGreaterThan(100)
  })

  it(`keeps the pitch-class wrap in ${MOD12_HOME} alone`, () => {
    const offenders = sources
      .filter((path) => !path.replaceAll('\\', '/').endsWith(MOD12_HOME))
      .flatMap((path) => findMod12(readFileSync(path, 'utf8'), path))
      .map(({ path, line, text }) => `  ${path}:${line} — ${text}`)
    expect(
      offenders,
      `\nhand-rolled pitch-class wrap (use \`pitchClass\` from shared/units.ts):\n${offenders.join('\n')}`
    ).toEqual([])
  })

  it('never grows a unit-named declaration typed as bare number', () => {
    const found = sources.flatMap((path) =>
      findUntypedUnits(readFileSync(path, 'utf8'), path)
    )
    for (const [suffix, pin] of Object.entries(NAME_TYPE_PIN)) {
      const hits = found.filter((f) => f.suffix === suffix)
      const listing = hits
        .map(({ path, line, text }) => `  ${path}:${line} — ${text}`)
        .join('\n')
      expect(
        hits.length,
        `\n*${suffix} names typed as bare number: ${hits.length}, pin ${pin}.` +
          `\nAbove the pin: brand the new ones (shared/units.ts).` +
          `\nBelow the pin: ratchet NAME_TYPE_PIN.${suffix} down to ${hits.length} in this PR.\n${listing}`
      ).toBe(pin)
    }
  })
})
