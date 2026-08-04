import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Design fitness function for PORT CONTRACTS AND THEIR FAKES (revue SOLID
 * 2026-08-04, constats LSP n° 4–5 — substitutability promised on paper but
 * unproven in execution). Two rules:
 *
 * 1. **A contract runs ×2 or it is a comment.** Every `*Contract` suite
 *    exported from a `testing/` directory must be replayed by at least two
 *    spec files: the reference fake AND one real adapter (ADR 0002). One call
 *    site means the substitutability proof exists but proves nothing — which
 *    is exactly how `projectStoreContract` silently stopped covering the real
 *    adapter when the fs adapter died in the Tauri pivot.
 * 2. **Fakes converge on the reference.** A spec or test-kit file that
 *    co-declares the whole member set of a port owning a reference fake is a
 *    hand-rolled double, free to drift out of the real value domain (PR #209,
 *    the English-ids no-op). Use the reference from `@app/core/testing`; the
 *    sorted allowlist names the deliberate exceptions (all-fail brokens
 *    exercising the error path) with their reason.
 */

/** Ports whose reference fake every hand-rolled double must converge on. */
const PORT_FAKES = [
  {
    port: 'ProjectStore',
    members: ['list:', 'load:', 'save:', 'delete:'],
    reference: 'core/src/project/testing/in-memory-project-store.ts',
    /** Sorted; every entry is a deliberate exception with its reason. */
    allowed: [
      // Failing overrides layered on top of the reference fake — error paths.
      'core/src/project/application/projects.spec.ts',
      // brokenProjectStores: the all-fail double the shell error specs need;
      // 'unknown' IS in the real failure contract (untyped throws exist).
      'web/src/app/workstation-shell/shell-test-kit.tsx',
      // brokenStores + a flaky-list override on top of the reference fake.
      'web/src/projects/use-projects.spec.tsx'
    ]
  }
] as const

function walk(dir: string, keep: (name: string) => boolean): readonly string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      return entry.name === '.stryker-tmp' ? [] : walk(path, keep)
    }
    return keep(entry.name) ? [path] : []
  })
}

const coreRoot = fileURLToPath(new URL('.', import.meta.url))
const webRoot = fileURLToPath(new URL('../../web/src', import.meta.url))
/** This very file spells the member sets in its config — never a double. */
const self = fileURLToPath(import.meta.url)
const normalized = (path: string): string => path.replaceAll('\\', '/')

/** Exported `…Contract` suites declared under a testing/ directory. */
function contractExports(): ReadonlyArray<{
  readonly name: string
  readonly file: string
}> {
  return [coreRoot, webRoot]
    .flatMap((root) => walk(root, (name) => /^[^.]+\.ts$/.test(name)))
    .filter((path) => normalized(path).includes('/testing/'))
    .flatMap((path) =>
      [
        ...readFileSync(path, 'utf8').matchAll(
          /export function (\w+Contract)\(/g
        )
      ].map((match) => ({ name: match[1] as string, file: path }))
    )
}

describe('contract discipline over core and web', () => {
  const specs = [coreRoot, webRoot].flatMap((root) =>
    walk(root, (name) => /\.spec\.tsx?$/.test(name))
  )

  it('still finds contract suites to hold to account', () => {
    expect(contractExports().length).toBeGreaterThan(0)
  })

  it.each(contractExports())(
    'replays $name against the reference fake AND a real adapter',
    ({ name }) => {
      const callers = specs.filter((path) =>
        readFileSync(path, 'utf8').includes(`${name}(`)
      )
      expect(
        callers.length,
        `\n${name} is replayed by ${callers.length} spec file(s):` +
          `\n${callers.map((c) => `  ${c}`).join('\n')}` +
          `\nADR 0002 promises the contract against EVERY implementation — the` +
          `\nreference fake and at least one real adapter (≥ 2 call sites).`
      ).toBeGreaterThanOrEqual(2)
    }
  )

  it.each(PORT_FAKES)(
    'keeps every hand-rolled $port double on the allowlist',
    ({ port, members, reference, allowed }) => {
      const kits = [coreRoot, webRoot].flatMap((root) =>
        walk(root, (name) => /\.spec\.tsx?$|test-kit/.test(name))
      )
      const offenders = kits.filter((path) => {
        const p = normalized(path)
        if (path === self || allowed.some((suffix) => p.endsWith(suffix))) {
          return false
        }
        const source = readFileSync(path, 'utf8')
        return members.every((member) => source.includes(member))
      })
      expect(
        offenders,
        `\nhand-rolled ${port} double(s) outside the allowlist:` +
          `\n${offenders.map((o) => `  ${o}`).join('\n')}` +
          `\nConverge on the reference fake (${reference}) or add the file to` +
          `\nthe sorted allowlist with the reason it must stay hand-rolled.`
      ).toEqual([])
    }
  )
})
