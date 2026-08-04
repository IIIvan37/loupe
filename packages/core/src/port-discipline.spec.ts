import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Design fitness function for PORT SHAPE (revue SOLID 2026-08-04, famille
 * ISP ; proposé par la revue justesse). An optional method in a port
 * interface is an interface admitting it is several — the consumer that
 * needs `spectrum?()` and the one that does not are two consumers, and the
 * `?` makes every adapter carry the question. New ports declare separate,
 * consumer-shaped interfaces instead (the `StemMixGraph`/`PlaybackTransport`
 * partition idiom).
 *
 * Ratchet: the count of optional members across the core's `ports.ts` files
 * is pinned at the measured present and only ever descends. Above the pin =
 * a new optional crept in (split the port); below = ratchet the pin down in
 * the same PR.
 */

// ── Ratchet — LOWER as ports are split, NEVER raise. ────────────────────────
// The 3 of 2026-08-04: spectrum?() ×2 (PlaybackEngine/StemPlaybackEngine)
// and setStemFilter?() — browser-capability escapes predating the seams.
const OPTIONAL_MEMBERS_PIN = 3

/** An optional CALLABLE member: `name?(…)` shorthand, or `name?: (…) => …`.
 * Optional data fields (`artist?: string`, `signal?: AbortSignal`) are value
 * shape, not interface identity — they stay out of scope. */
const OPTIONAL_METHOD = /^\s*(?:readonly\s+)?[\w$]+\?\s*\(/
const OPTIONAL_FN_PROP = /^\s*(?:readonly\s+)?[\w$]+\?\s*:\s*\(.*=>/

function portFiles(dir: string): readonly string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      return entry.name === '.stryker-tmp' ? [] : portFiles(path)
    }
    return entry.name === 'ports.ts' ? [path] : []
  })
}

interface Finding {
  readonly path: string
  readonly line: number
  readonly text: string
}

function optionalMembers(source: string, path: string): readonly Finding[] {
  return source
    .split('\n')
    .flatMap((text, index) =>
      (OPTIONAL_METHOD.test(text) || OPTIONAL_FN_PROP.test(text)) &&
      !/^\s*(\/\/|\*|\/\*)/.test(text)
        ? [{ path, line: index + 1, text: text.trim() }]
        : []
    )
}

const coreRoot = fileURLToPath(new URL('.', import.meta.url))

describe('the detector itself', () => {
  it.each([
    'spectrum?(): SpectrumFrame | undefined',
    '  setStemFilter?(id: string, filter: StemFilter): void',
    '  readonly onProgress?: (fraction: number) => void'
  ])('flags the optional member %j', (source) => {
    expect(optionalMembers(source, 'x.ts')).toHaveLength(1)
  })

  it.each([
    'readonly spectrum: () => SpectrumFrame',
    'load(stems: StemSet): void',
    '  signal?: AbortSignal',
    '  readonly artist?: string',
    '  // spectrum?() is the counter-example this spec exists for',
    'const maybe = flag ? a : b'
  ])('leaves %j alone (required, data field, prose)', (source) => {
    expect(optionalMembers(source, 'x.ts')).toEqual([])
  })
})

describe('port discipline over the core ports', () => {
  const files = portFiles(coreRoot)

  it('finds ports.ts files to scan (a silent empty scan proves nothing)', () => {
    expect(files.length).toBeGreaterThanOrEqual(5)
  })

  it('never grows an optional member in a port interface', () => {
    const found = files.flatMap((path) =>
      optionalMembers(readFileSync(path, 'utf8'), path)
    )
    const listing = found
      .map(({ path, line, text }) => `  ${path}:${line} — ${text}`)
      .join('\n')
    expect(
      found.length,
      `\noptional port members: ${found.length}, pin ${OPTIONAL_MEMBERS_PIN}.` +
        `\nAbove the pin: an optional method is an interface admitting it is` +
        `\nseveral — declare a separate consumer-shaped port instead.` +
        `\nBelow the pin: ratchet OPTIONAL_MEMBERS_PIN down in this PR.\n${listing}`
    ).toBe(OPTIONAL_MEMBERS_PIN)
  })
})
