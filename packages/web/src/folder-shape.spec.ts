import { readdirSync } from 'node:fs'
import { join } from 'node:path'
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
/** Direct non-spec sources a single folder may hold (today `app/ui` and
 * `app/lead-sheet`). */
const MAX_FLAT_SOURCES = 16

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

describe('ADR 0013 — folder shape ratchet', () => {
  it(`keeps every folder at most ${MAX_FLAT_SOURCES} direct sources`, () => {
    const offenders = walk(WEB_SRC)
      .filter((folder) => folder.count > MAX_FLAT_SOURCES)
      .map((folder) => `${folder.dir}: ${folder.count} sources`)
    expect(
      offenders.length,
      `folders past reading at a glance:\n${offenders.join('\n')}`
    ).toBe(0)
  })
})
