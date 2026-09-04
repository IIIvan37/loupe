import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Fitness function for the gate's step list.
 *
 * ONE list of blocking checks lives in TWO places, in two languages:
 *
 * - `package.json` → the `gate` script, run by hand and by CI.
 * - `.husky/pre-commit` → the replay, run on every commit that misses the
 *   stamp.
 *
 * Both are `pnpm run "/^(a|b|c)$/"` regexes. The regex form was chosen so the
 * list could not drift inside itself — and it works for that. It does nothing
 * about the two copies: `check:tokens` went missing from the hook once, and
 * `check:tests` went missing the day it was added (2026-09-04).
 *
 * The drift is silent AND self-sealing: the hook runs its shorter set, then
 * `gate-stamp.sh write` stamps the tree as validated, so a later `pnpm gate` on
 * those bytes is skipped by the stamp. The tree then carries a "gate green"
 * stamp for a check that never ran on it.
 *
 * The one intended difference is repo-wide `check` (biome): the hook replaces
 * it with a staged-only pass, documented at `.husky/pre-commit:80-84`.
 */

const ROOT = fileURLToPath(new URL('..', import.meta.url))

/** The steps of a `pnpm run "/^(a|b|c)$/"` invocation, in order. The quotes
 * are backslash-escaped inside package.json's JSON string, bare in the hook. */
function stepsOf(file: string, source: string): readonly string[] {
  const match = /pnpm run \\?"\/\^\(([^)]+)\)\$\/\\?"/.exec(source)
  if (!match?.[1]) {
    throw new Error(`no \`pnpm run "/^(…)$/"\` regex found in ${file}`)
  }
  return match[1].split('|')
}

const gateSteps = stepsOf(
  'package.json',
  readFileSync(join(ROOT, 'package.json'), 'utf8')
)
const hookSteps = stepsOf(
  '.husky/pre-commit',
  readFileSync(join(ROOT, '.husky/pre-commit'), 'utf8')
)

/** Repo-wide biome, replaced in the hook by the staged-only pass. */
const INTENDED_HOOK_OMISSIONS = new Set(['check'])

describe('the gate step list is the same in both of its homes', () => {
  it('finds a real list in each (a silent empty match proves nothing)', () => {
    expect(gateSteps.length).toBeGreaterThanOrEqual(10)
    expect(hookSteps.length).toBeGreaterThanOrEqual(10)
  })

  it('runs every gate step on commit, except the documented omission', () => {
    const missing = gateSteps.filter(
      (step) => !hookSteps.includes(step) && !INTENDED_HOOK_OMISSIONS.has(step)
    )
    expect(
      missing,
      `\n.husky/pre-commit does not run: ${missing.join(', ')}.` +
        '\nA step in `gate` but not in the hook does not run on commit — and the' +
        '\nhook still stamps the tree green afterwards, so `pnpm gate` will skip' +
        '\nit too. Add it to the hook regex, or to INTENDED_HOOK_OMISSIONS with' +
        '\na reason in the hook comment.'
    ).toEqual([])
  })

  it('runs nothing on commit that the gate itself does not run', () => {
    const extra = hookSteps.filter((step) => !gateSteps.includes(step))
    expect(
      extra,
      `\n.husky/pre-commit runs steps absent from \`gate\`: ${extra.join(', ')}.` +
        '\nA commit would then fail on a check CI never runs, or pass one the' +
        '\ngate does not cover.'
    ).toEqual([])
  })
})
