import { readdirSync, readFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * ADR 0013 — a folder reads at a glance. Bounds the DIRECT source files per
 * directory of the web tree: colocated specs and CSS are free (the convention
 * is wanted), only `.ts`/`.tsx` sources count. Like the ADR 0010 ratchets the
 * threshold starts at the measured present and only ever descends — a leaf
 * that shelves a folder (role subfolders, component folders) lowers it in the
 * same PR; nothing may raise it.
 */

// ── Ratchet — LOWER as leaves land, NEVER raise. ────────────────────────────
/** Direct non-spec sources a single folder may hold (today `lib`,
 * `app/waveform` and the `app/lead-sheet` root). */
const MAX_FLAT_SOURCES = 11
/** Components still importing ANOTHER component's `.module.css` — a component
 * owns its stylesheet; shared skins travel through `composes`, never through
 * a neighbour's import. Target: 0. */
const MAX_FOREIGN_CSS_IMPORTS = 0
/** Floors under what the two ratchets actually range over — 192 counted
 * sources spread over 83 folders, and 132 `.tsx` files, today. Unlike the
 * bounds above these RISE with the tree and never drop.
 *
 * The floor sits on the COUNTED SOURCES, not on the folder count: `walk`
 * returns one entry per directory whatever `isCountedSource` accepts, so a
 * broken filter leaves 83 folders holding 0 sources each — every count under
 * the maximum, the ratchet green, and nothing guarded. */
const MIN_COUNTED_SOURCES = 150
const MIN_TSX_FILES = 90

const WEB_SRC = fileURLToPath(new URL('.', import.meta.url))

/** A counted source: TS/TSX, not a colocated spec, not ambient types. */
function isCountedSource(name: string): boolean {
  return /\.tsx?$/.test(name) && !/\.spec\.tsx?$|\.d\.ts$/.test(name)
}

function walk(dir: string): { dir: string; count: number }[] {
  const entries = readdirSync(dir, { withFileTypes: true })
  const nested = entries
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => walk(join(dir, entry.name)))
  const count = entries.filter(
    (entry) => entry.isFile() && isCountedSource(entry.name)
  ).length
  return [{ dir, count }, ...nested]
}

function* sourceFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      yield* sourceFiles(path)
    } else if (/\.tsx$/.test(entry.name)) {
      yield path
    }
  }
}

// Walked once, read by every test below — the shape `composition-invariants`
// already uses for `FILES`. Two tests each re-running both walkers cost a
// second full traversal of packages/web/src on every suite run.
const FOLDERS = walk(WEB_SRC)
const TSX_FILES = [...sourceFiles(WEB_SRC)]

describe('ADR 0013 — folder shape ratchets', () => {
  // Both walkers must actually see the tree, or the two bounds below are
  // green over nothing. `walk` and `sourceFiles` filter on different
  // extensions, so each needs its own floor.
  it(`counts at least ${MIN_COUNTED_SOURCES} sources and ${MIN_TSX_FILES} .tsx files`, () => {
    expect(
      FOLDERS.reduce((total, f) => total + f.count, 0),
      'the source filter matched (almost) nothing — every folder counts 0 and' +
        ' the ratchet below is vacuous'
    ).toBeGreaterThanOrEqual(MIN_COUNTED_SOURCES)
    expect(
      TSX_FILES.length,
      'the .tsx walker found (almost) nothing — the ratchet below is vacuous'
    ).toBeGreaterThanOrEqual(MIN_TSX_FILES)
  })

  it(`keeps every folder at most ${MAX_FLAT_SOURCES} direct sources`, () => {
    const offenders = FOLDERS.filter(
      (folder) => folder.count > MAX_FLAT_SOURCES
    ).map((folder) => `${folder.dir}: ${folder.count} sources`)
    expect(
      offenders.length,
      `folders past reading at a glance:\n${offenders.join('\n')}`
    ).toBe(0)
  })

  it(`has at most ${MAX_FOREIGN_CSS_IMPORTS} foreign module.css imports (target 0)`, () => {
    const offenders: string[] = []
    for (const file of TSX_FILES) {
      const own = basename(file).replace(/\.tsx$/, '')
      for (const match of readFileSync(file, 'utf8').matchAll(
        /from\s+['"]([^'"]+\.module\.css)['"]/g
      )) {
        const imported = basename(match[1] ?? '').replace(/\.module\.css$/, '')
        if (imported !== own) {
          offenders.push(`${file} -> ${match[1]}`)
        }
      }
    }
    expect(
      offenders.length,
      `components leaning on a neighbour's stylesheet:\n${offenders.join('\n')}`
    ).toBeLessThanOrEqual(MAX_FOREIGN_CSS_IMPORTS)
  })
})
