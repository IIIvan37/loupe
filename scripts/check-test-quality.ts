// check:tests — the gate's guard against tests that pass without proving
// anything. A red gate is a fact; a green gate is only worth what its weakest
// test asserts, and this repo has shipped three tests that asserted nothing:
// a `livingDocs()` check that passed because the detector could not see the
// tree, a tautological "dormant" test, and a scenario whose own setup undid
// the failure it claimed to exercise.
//
// Four rules over every `*.spec.ts(x)`:
//
//   skipped       `.skip` / `.only` / `.todo` on describe/it/test. A skipped
//                 test is a green tick over code nobody runs; `.only` silently
//                 retires every other test in the file.
//   no-assertion  a spec file with no `expect(` at all — it can only fail by
//                 throwing, which is not what its name claims.
//   tautology     `expect(X).toBe(X)` and friends, where both sides are the
//                 same SIDE-EFFECT-FREE expression text. True for every
//                 implementation. An expression containing a call is exempt:
//                 `expect(memo(a)).toBe(memo(a))` asserts that two calls return
//                 the same reference, which is the whole point of a memo — the
//                 two encode-memo specs here are exactly that shape.
//   blind-corpus  a spec that WALKS A DIRECTORY (readdirSync / globSync) with
//                 no assertion bounding a size from below. `readdirSync`
//                 returns [] without complaining, and the `offenders.length
//                 <= MAX` shape that every fitness function here uses is green
//                 over the empty set. This is the `livingDocs()` failure.
//                 `readFileSync` on a named path is NOT flagged: it throws on
//                 a missing file, so it cannot go quiet.
//
// The last rule is a floor, not a proof: it requires that a lower bound exist,
// not that it range over the right set. What the bound proves is the spec's
// job to say.
//
// SELF-TEST. A detector added over a clean tree has never been seen to fail,
// which is the very failure this script exists to catch — so it refuses to
// report on the repo before proving itself. Every run first applies the rules
// to the fixtures below: each must trip exactly its own rule, and the clean
// one must trip nothing. A rule that stops firing fails the gate even when the
// repo is spotless.
//
// Run: pnpm check:tests (part of `pnpm gate`).

import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

/** Rule names, in report order. */
type Rule = 'skipped' | 'no-assertion' | 'tautology' | 'blind-corpus'

interface Finding {
  readonly rule: Rule
  readonly file: string
  readonly line: number
  readonly detail: string
}

const SKIP_MODIFIERS = new Set(['skip', 'only', 'todo'])
const RUNNERS = new Set(['describe', 'it', 'test'])
const EQUALITY_MATCHERS = new Set(['toBe', 'toEqual', 'toStrictEqual'])
const LOWER_BOUND_MATCHERS = new Set([
  'toBeGreaterThan',
  'toBeGreaterThanOrEqual'
])
/** Directory walkers: they return an empty list instead of throwing. */
const DIRECTORY_WALKERS = new Set(['readdirSync', 'globSync', 'glob'])

/** Directories never swept: dependencies, build output, mutation sandboxes. */
const PRUNED = new Set([
  'node_modules',
  'dist',
  'coverage',
  '.git',
  '.stryker-tmp',
  '.claude'
])

function specFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) {
      return PRUNED.has(entry.name) ? [] : specFiles(join(dir, entry.name))
    }
    return /\.spec\.tsx?$/.test(entry.name) ? [join(dir, entry.name)] : []
  })
}

function parse(file: string, source: string): ts.SourceFile {
  return ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  )
}

/** `describe.skip` / `it.only` / `test.todo` — including `it.skip.each`. */
function skipModifier(node: ts.Node): string | undefined {
  if (!ts.isPropertyAccessExpression(node)) return undefined
  const base = node.expression
  const root = ts.isPropertyAccessExpression(base) ? base.expression : base
  if (!ts.isIdentifier(root) || !RUNNERS.has(root.text)) return undefined
  return SKIP_MODIFIERS.has(node.name.text) ? node.name.text : undefined
}

/** Whether an expression can yield a different value on a second evaluation —
 * a call, an `await`, a `new`. Two textually identical such expressions are
 * not a tautology: comparing them is how a memo, a cache or a frozen singleton
 * is tested. */
function mayVaryPerEvaluation(node: ts.Node): boolean {
  if (
    ts.isCallExpression(node) ||
    ts.isAwaitExpression(node) ||
    ts.isNewExpression(node)
  ) {
    return true
  }
  return ts.forEachChild(node, mayVaryPerEvaluation) === true
}

/** The matcher of `expect(x).matcher(y)`, with both argument texts. */
function assertion(node: ts.Node):
  | {
      matcher: string
      subject: ts.Expression | undefined
      expected: ts.Expression | undefined
    }
  | undefined {
  if (!ts.isCallExpression(node)) return undefined
  const callee = node.expression
  if (!ts.isPropertyAccessExpression(callee)) return undefined
  // Unwrap `.not`, `.resolves`, `.rejects` between expect() and the matcher.
  let inner = callee.expression
  while (ts.isPropertyAccessExpression(inner)) inner = inner.expression
  if (
    !ts.isCallExpression(inner) ||
    !ts.isIdentifier(inner.expression) ||
    inner.expression.text !== 'expect'
  ) {
    return undefined
  }
  return {
    matcher: callee.name.text,
    subject: inner.arguments[0],
    expected: node.arguments[0]
  }
}

function inspect(file: string, source: string): Finding[] {
  const sf = parse(file, source)
  const findings: Finding[] = []
  let expectCalls = 0
  let walksDirectory: ts.Node | undefined
  let hasLowerBound = false

  const lineOf = (node: ts.Node): number =>
    sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1

  const visit = (node: ts.Node): void => {
    const modifier = skipModifier(node)
    if (modifier !== undefined) {
      findings.push({
        rule: 'skipped',
        file,
        line: lineOf(node),
        detail: `${node.getText(sf)} — a skipped test is a green tick over code nobody runs`
      })
    }

    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'expect'
    ) {
      expectCalls += 1
    }

    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      DIRECTORY_WALKERS.has(node.expression.text)
    ) {
      walksDirectory ??= node
    }

    const asserted = assertion(node)
    if (asserted) {
      if (LOWER_BOUND_MATCHERS.has(asserted.matcher)) hasLowerBound = true
      const { subject, expected, matcher } = asserted
      if (
        EQUALITY_MATCHERS.has(matcher) &&
        subject !== undefined &&
        expected !== undefined &&
        subject.getText(sf) === expected.getText(sf) &&
        !mayVaryPerEvaluation(subject)
      ) {
        findings.push({
          rule: 'tautology',
          file,
          line: lineOf(node),
          detail: `expect(${subject.getText(sf)}).${matcher}(${expected.getText(sf)}) — true for every implementation`
        })
      }
    }

    ts.forEachChild(node, visit)
  }
  visit(sf)

  if (expectCalls === 0) {
    findings.push({
      rule: 'no-assertion',
      file,
      line: 1,
      detail: 'no expect() in the whole file — it can only fail by throwing'
    })
  }

  if (walksDirectory !== undefined && !hasLowerBound) {
    findings.push({
      rule: 'blind-corpus',
      file,
      line: lineOf(walksDirectory),
      detail:
        'walks a directory with no lower bound on the corpus — an empty walk' +
        ' satisfies every `length <= MAX` assertion in silence'
    })
  }

  return findings
}

// ── Self-test ──────────────────────────────────────────────────────────────
// Each fixture must trip exactly its own rule. Deliberately minimal: the point
// is that the rule FIRES, not that the fixture is realistic.

const FIXTURES: readonly { rule: Rule | 'clean'; source: string }[] = [
  {
    rule: 'skipped',
    source: `import { describe, expect, it } from 'vitest'
describe('x', () => { it.skip('y', () => { expect(1).toBe(2) }) })`
  },
  {
    rule: 'no-assertion',
    source: `import { describe, it } from 'vitest'
describe('x', () => { it('y', () => { doSomething() }) })`
  },
  {
    rule: 'tautology',
    source: `import { describe, expect, it } from 'vitest'
describe('x', () => { it('y', () => { expect(value.id).toBe(value.id) }) })`
  },
  {
    rule: 'blind-corpus',
    source: `import { readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
const FILES = readdirSync('src')
describe('x', () => { it('y', () => { expect(FILES.length).toBeLessThanOrEqual(9) }) })`
  },
  {
    // The shape the tautology rule must NOT flag: two calls compared by
    // reference is how memoization is asserted (encode-wav-memo.spec.ts).
    rule: 'clean',
    source: `import { describe, expect, it } from 'vitest'
describe('memo', () => {
  it('returns the same reference twice', () => {
    expect(encodeWavMemo(audio)).toBe(encodeWavMemo(audio))
  })
})`
  },
  {
    rule: 'clean',
    source: `import { readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
const FILES = readdirSync('src')
describe('x', () => {
  it('sees a real corpus', () => { expect(FILES.length).toBeGreaterThan(10) })
  it('bounds it', () => { expect(FILES.length).toBeLessThanOrEqual(99) })
})`
  }
]

function selfTest(): string[] {
  const failures: string[] = []
  for (const fixture of FIXTURES) {
    const fired = new Set(
      inspect(`self-test/${fixture.rule}.spec.ts`, fixture.source).map(
        (f) => f.rule
      )
    )
    const expected =
      fixture.rule === 'clean' ? new Set<Rule>() : new Set([fixture.rule])
    const missing = [...expected].filter((rule) => !fired.has(rule))
    const extra = [...fired].filter((rule) => !expected.has(rule as Rule))
    if (missing.length > 0) {
      failures.push(
        `rule "${fixture.rule}" did not fire on its own fixture — it has stopped detecting anything`
      )
    }
    if (extra.length > 0) {
      failures.push(
        `fixture "${fixture.rule}" also tripped ${extra.join(', ')} — the rules overlap, findings will be noisy`
      )
    }
  }
  return failures
}

// ── Run ────────────────────────────────────────────────────────────────────

const selfTestFailures = selfTest()
if (selfTestFailures.length > 0) {
  console.error('check:tests — the detector failed its own self-test:\n')
  for (const failure of selfTestFailures) console.error(`  ${failure}`)
  console.error(
    '\nFix the rule before trusting any sweep: a detector that cannot fire' +
      '\nreports a clean tree whatever the tree contains.'
  )
  process.exit(1)
}

const files = specFiles(ROOT)
if (files.length < 100) {
  console.error(
    `check:tests — found only ${files.length} spec files, expected at least 100.` +
      '\nThe sweep itself has gone blind; fix the walker before reading its verdict.'
  )
  process.exit(1)
}

const findings = files.flatMap((file) =>
  inspect(relative(ROOT, file), readFileSync(file, 'utf8'))
)

if (findings.length > 0) {
  const order: Rule[] = ['skipped', 'no-assertion', 'tautology', 'blind-corpus']
  console.error(
    `check:tests — ${findings.length} test(s) that pass without proving anything:\n`
  )
  for (const rule of order) {
    const matching = findings.filter((f) => f.rule === rule)
    if (matching.length === 0) continue
    console.error(`  ${rule}:`)
    for (const finding of matching) {
      console.error(`    ${finding.file}:${finding.line} — ${finding.detail}`)
    }
    console.error('')
  }
  process.exit(1)
}

console.log(
  `check:tests — ${files.length} spec files swept, 4 rules self-tested, no vacuous test.`
)
