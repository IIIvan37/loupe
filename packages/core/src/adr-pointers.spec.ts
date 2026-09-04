import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Design fitness function for ADR POINTERS (revue SOLID 2026-08-04, famille
 * SRP/DIP). The review's 14 refuted findings all fell to the same defence: a
 * decision CONSIGNED at the point of friction (an `ADR NNNN` comment, a
 * module docstring) — and the 6 confirmed ones had none. The judgment itself
 * cannot be mechanised; what can is the pointer's integrity: every `ADR NNNN`
 * referenced from a source comment must resolve to a real record under
 * docs/adr/, so a renumbered or deleted ADR cannot leave silent dangling
 * defences (the living-docs link-checker stance, applied to code).
 */

const ADR_REF = /\bADR\s+(\d{4})\b/g

function sources(dir: string): readonly string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      return entry.name === '.stryker-tmp' ? [] : sources(path)
    }
    return /\.tsx?$/.test(entry.name) ? [path] : []
  })
}

const coreRoot = fileURLToPath(new URL('.', import.meta.url))
const webRoot = fileURLToPath(new URL('../../web/src', import.meta.url))
const adrRoot = fileURLToPath(new URL('../../../docs/adr', import.meta.url))
const sheriff = fileURLToPath(
  new URL('../../../sheriff.config.ts', import.meta.url)
)

describe('ADR pointers over core, web and sheriff config', () => {
  const known = new Set(
    readdirSync(adrRoot)
      .map((name) => /^(\d{4})-/.exec(name)?.[1])
      .filter((id): id is string => id !== undefined)
  )

  const files = [...sources(coreRoot), ...sources(webRoot), sheriff]

  // Two corpora, two floors. The ADR ids were already floored; the SOURCES
  // were not, and that is the corpus the assertion below ranges over — a
  // broken `\.tsx?$` filter would leave `files` at `[sheriff]`, `dangling`
  // empty, and the guard green over nothing.
  it('finds recorded ADRs and sources to scan (a silent empty scan proves nothing)', () => {
    expect(known.size).toBeGreaterThanOrEqual(13)
    expect(files.length).toBeGreaterThanOrEqual(350)
  })

  it('resolves every ADR reference to a recorded decision', () => {
    const dangling = files.flatMap((path) =>
      [...readFileSync(path, 'utf8').matchAll(ADR_REF)]
        .map((match) => match[1] as string)
        .filter((id) => !known.has(id))
        .map((id) => `  ${path} → ADR ${id}`)
    )
    expect(
      dangling,
      `\nADR reference(s) with no record under docs/adr/:` +
        `\n${dangling.join('\n')}` +
        `\nA pointer to a missing decision is a defence that no longer exists —` +
        `\nrestore the record or rewrite the comment.`
    ).toEqual([])
  })
})
