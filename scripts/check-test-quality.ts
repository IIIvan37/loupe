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
//   blind-corpus  a directory walk with no lower bound on WHAT IT WALKED.
//                 `readdirSync` returns [] without complaining, and the
//                 `offenders.length <= MAX` shape that every fitness function
//                 here uses is green over the empty set. This is the
//                 `livingDocs()` failure. `readFileSync` on a named path is
//                 NOT flagged: it throws on a missing file, so it cannot go
//                 quiet.
//
// The blind-corpus rule is PER WALKER, not per file. A file-wide "some lower
// bound exists" flag is the same vacuity one level up, and it shipped one:
// `adr-pointers.spec.ts` floors the ADR id set at the top, which used to
// silence the rule for the source corpus that the actual assertion ranges
// over. So the rule resolves each local function that reaches a walker
// (`sources`, `sourceFiles`, `walk`, `markdownIn` …), tracks which identifier
// each call is bound to, and demands a lower bound naming THAT walker or THAT
// identifier. Coverage is required only for calls made outside a walker's own
// body — `readdirSync` inside `sourceFiles` is the same walk, already covered
// by the bound on `sourceFiles`.
//
// It is still a floor, not a proof: it requires that a lower bound exist and
// name the right corpus, not that the number be well chosen. What the bound
// proves is the spec's job to say.
//
// SELF-TEST. A detector added over a clean tree has never been seen to fail,
// which is the very failure this script exists to catch — so it refuses to
// report on the repo before proving itself. Every run first applies the rules
// to the fixtures below: each must trip exactly its own rule, and the clean
// ones must trip nothing. A rule that stops firing fails the gate even when
// the repo is spotless.
//
// Run: pnpm check:tests (part of `pnpm gate`).

import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

/** Rule names, in report order — the single source for the type, the report
 * order and the count in the success line. */
const RULES = ['skipped', 'no-assertion', 'tautology', 'blind-corpus'] as const
type Rule = (typeof RULES)[number]

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

/** The roots vitest collects specs from (`vitest.config.ts` `include`). Rooting
 * the sweep here rather than at the repo root with a denylist keeps it off the
 * 2 GB `target/` tree, and removes a hand-maintained shadow of `.gitignore`
 * that would drift the first time a build directory is added. */
const SPEC_ROOTS = ['packages', 'docs']

/** Floor on the sweep itself — 187 spec files today. The detector demands of
 * itself what it demands of every spec: raise it as the tree grows, never
 * lower it to fit a walker that stopped seeing the code. */
const MIN_SPEC_FILES = 100

function specFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      return entry.name === 'node_modules' ? [] : specFiles(path)
    }
    return /\.spec\.tsx?$/.test(entry.name) ? [path] : []
  })
}

function parse(file: string, source: string): ts.SourceFile {
  return ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    // No rule reads `.parent`; every positional call passes `sf` explicitly.
    // Setting parent pointers costs ~25 % of the parse for nothing.
    false,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  )
}

/** `describe.skip` / `it.only` / `test.todo` — including `it.skip.each`. */
function isSkipped(node: ts.Node): boolean {
  if (!ts.isPropertyAccessExpression(node)) return false
  const base = node.expression
  const root = ts.isPropertyAccessExpression(base) ? base.expression : base
  return (
    ts.isIdentifier(root) &&
    RUNNERS.has(root.text) &&
    SKIP_MODIFIERS.has(node.name.text)
  )
}

/** Whether an expression can yield a different value on a second evaluation —
 * a call, an `await`, a `new`. Two textually identical such expressions are
 * not a tautology: comparing them is how a memo, a cache or a frozen singleton
 * is tested. */
const mayVaryPerEvaluation = (node: ts.Node): boolean =>
  ts.isCallExpression(node) ||
  ts.isAwaitExpression(node) ||
  ts.isNewExpression(node) ||
  ts.forEachChild(node, mayVaryPerEvaluation) === true

interface Assertion {
  readonly matcher: string
  readonly subject: ts.Expression
  readonly expected: ts.Expression | undefined
}

/** The matcher of `expect(x).matcher(y)`, with both operands. */
function assertion(node: ts.Node): Assertion | undefined {
  if (!ts.isCallExpression(node)) return undefined
  const callee = node.expression
  if (!ts.isPropertyAccessExpression(callee)) return undefined
  // Descend to the head of the property chain: `.not`, `.resolves` and any
  // other modifier sits between `expect()` and the matcher.
  let inner = callee.expression
  while (ts.isPropertyAccessExpression(inner)) inner = inner.expression
  if (
    !ts.isCallExpression(inner) ||
    !ts.isIdentifier(inner.expression) ||
    inner.expression.text !== 'expect'
  ) {
    return undefined
  }
  const subject = inner.arguments[0]
  if (subject === undefined) return undefined
  return { matcher: callee.name.text, subject, expected: node.arguments[0] }
}

/** The name a function is declared under, for `function f() {}` and
 * `const f = () => {}` alike. */
function declaredName(node: ts.Node): string | undefined {
  if (ts.isFunctionDeclaration(node)) return node.name?.text
  if (
    ts.isVariableDeclaration(node) &&
    ts.isIdentifier(node.name) &&
    node.initializer !== undefined &&
    (ts.isArrowFunction(node.initializer) ||
      ts.isFunctionExpression(node.initializer))
  ) {
    return node.name.text
  }
  return undefined
}

/** Every call to a bare identifier inside a subtree. */
function calleesIn(node: ts.Node): Set<string> {
  const names = new Set<string>()
  const visit = (child: ts.Node): void => {
    if (ts.isCallExpression(child) && ts.isIdentifier(child.expression)) {
      names.add(child.expression.text)
    }
    ts.forEachChild(child, visit)
  }
  visit(node)
  return names
}

/** Every bare identifier referenced in a subtree — how a corpus travels from
 * one binding to the next (`const callers = specs.filter(…)`). */
function identifiersIn(node: ts.Node): Set<string> {
  const names = new Set<string>()
  const visit = (child: ts.Node): void => {
    if (ts.isIdentifier(child)) names.add(child.text)
    ts.forEachChild(child, visit)
  }
  visit(node)
  return names
}

/** `it.each(table)` / `describe.each(table)`, including the tagged-template and
 * `it.each(…)( … )` call shapes. Vitest fails a suite whose table is empty
 * ("No test found in suite"), so such a table is a floor on its own. */
function isEachTable(node: ts.Node): node is ts.CallExpression {
  if (!ts.isCallExpression(node)) return false
  const callee = node.expression
  return (
    ts.isPropertyAccessExpression(callee) &&
    callee.name.text === 'each' &&
    ts.isIdentifier(callee.expression) &&
    RUNNERS.has(callee.expression.text)
  )
}

/** The walker names a file knows: the raw fs ones, plus every local function
 * that reaches one — transitively, so `sources` calling `readdirSync` and a
 * helper calling `sources` both count. Also returns where each walker function
 * is declared, so a call inside one is not asked for its own bound. */
function walkersOf(sf: ts.SourceFile): {
  names: ReadonlySet<string>
  bodies: readonly ts.Node[]
} {
  const names = new Set(DIRECTORY_WALKERS)
  const declarations = new Map<string, ts.Node>()

  const collect = (node: ts.Node): void => {
    const name = declaredName(node)
    if (name !== undefined) declarations.set(name, node)
    ts.forEachChild(node, collect)
  }
  collect(sf)

  // Fixed point: a function calling a known walker is itself a walker.
  for (let grew = true; grew; ) {
    grew = false
    for (const [name, node] of declarations) {
      if (names.has(name)) continue
      for (const callee of calleesIn(node)) {
        if (names.has(callee)) {
          names.add(name)
          grew = true
          break
        }
      }
    }
  }

  const bodies = [...declarations]
    .filter(([name]) => names.has(name))
    .map(([, node]) => node)
  return { names, bodies }
}

function inspect(file: string, source: string): Finding[] {
  const sf = parse(file, source)
  const findings: Finding[] = []
  const { names: walkers, bodies } = walkersOf(sf)
  let hasExpect = false
  /** Walker name → the first call site outside any walker body. */
  const uncoveredCalls = new Map<string, ts.Node>()
  /** Identifier a walker result was bound to → the walkers it came from. */
  const boundFrom = new Map<string, ReadonlySet<string>>()
  /** Subject text of every lower-bound assertion. */
  const flooredTexts: string[] = []

  const lineOf = (node: ts.Node): number =>
    sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1
  const insideWalker = (node: ts.Node): boolean =>
    bodies.some(
      (body) => node.getStart(sf) >= body.getStart(sf) && node.end <= body.end
    )

  const visit = (node: ts.Node): void => {
    if (isSkipped(node)) {
      findings.push({
        rule: 'skipped',
        file,
        line: lineOf(node),
        detail: `${node.getText(sf)} — a skipped test is a green tick over code nobody runs`
      })
    }

    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const callee = node.expression.text
      if (callee === 'expect') hasExpect = true
      if (walkers.has(callee) && !insideWalker(node)) {
        if (!uncoveredCalls.has(callee)) uncoveredCalls.set(callee, node)
      }
    }

    // `const FILES = sourceFiles(root)` — remember that FILES is a corpus, so a
    // bound naming FILES covers the walker it came from. Identifiers are
    // followed too (`const callers = specs.filter(…)`), so a bound on a
    // derived name still covers the walk it came from.
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer !== undefined
    ) {
      const from = new Set(
        [...calleesIn(node.initializer)].filter((name) => walkers.has(name))
      )
      for (const referenced of identifiersIn(node.initializer)) {
        for (const walker of boundFrom.get(referenced) ?? []) from.add(walker)
      }
      if (from.size > 0) boundFrom.set(node.name.text, from)
    }

    // `it.each(livingDocs())` is a structural floor: vitest fails the suite
    // with "No test found in suite" when the corpus is empty, so the walk
    // cannot go quiet. Verified, not assumed.
    if (isEachTable(node)) {
      const table = node.arguments[0]
      if (table !== undefined) flooredTexts.push(table.getText(sf))
    }

    const asserted = assertion(node)
    if (asserted) {
      const { subject, expected, matcher } = asserted
      if (LOWER_BOUND_MATCHERS.has(matcher)) {
        flooredTexts.push(subject.getText(sf))
      }
      if (
        EQUALITY_MATCHERS.has(matcher) &&
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

  if (!hasExpect) {
    findings.push({
      rule: 'no-assertion',
      file,
      line: 1,
      detail: 'no expect() in the whole file — it can only fail by throwing'
    })
  }

  /** A walker is covered when some lower bound names it, or names an
   * identifier bound from it. */
  const covered = (walker: string): boolean =>
    flooredTexts.some(
      (text) =>
        text.includes(walker) ||
        [...boundFrom].some(
          ([name, from]) => from.has(walker) && text.includes(name)
        )
    )

  for (const [walker, call] of uncoveredCalls) {
    if (covered(walker)) continue
    findings.push({
      rule: 'blind-corpus',
      file,
      line: lineOf(call),
      detail:
        `\`${walker}\` walks a directory with no lower bound on what it walked` +
        ' — an empty walk satisfies every `length <= MAX` assertion in silence'
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
    // The per-walker case, and the reason the rule is not a file-wide flag:
    // a floor on ONE corpus must not silence a second, unbounded walk. This is
    // the shape that shipped green in adr-pointers.spec.ts.
    rule: 'blind-corpus',
    source: `import { readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
function sources(dir) { return readdirSync(dir) }
const known = readdirSync('docs/adr')
describe('x', () => {
  it('floors the ids', () => { expect(known.length).toBeGreaterThan(13) })
  it('leaves the corpus blind', () => {
    const files = sources('src')
    expect(files.filter(bad)).toEqual([])
  })
})`
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
    // A walker reached through a local function, floored by the identifier it
    // was bound to — the composition-invariants shape. Must NOT be flagged,
    // and the inner `readdirSync` must not be asked for a bound of its own.
    rule: 'clean',
    source: `import { readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
function sourceFiles(dir) { return readdirSync(dir) }
const FILES = sourceFiles('src')
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
    if (fixture.rule !== 'clean' && !fired.delete(fixture.rule)) {
      failures.push(
        `rule "${fixture.rule}" did not fire on its own fixture — it has stopped detecting anything`
      )
    }
    if (fired.size > 0) {
      failures.push(
        `fixture "${fixture.rule}" also tripped ${[...fired].join(', ')} — the rules overlap, findings will be noisy`
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

const files = SPEC_ROOTS.flatMap((root) => specFiles(join(ROOT, root)))
if (files.length < MIN_SPEC_FILES) {
  console.error(
    `check:tests — found only ${files.length} spec files, expected at least ${MIN_SPEC_FILES}.` +
      '\nThe sweep itself has gone blind; fix the walker before reading its verdict.'
  )
  process.exit(1)
}

const findings = files.flatMap((file) =>
  inspect(relative(ROOT, file), readFileSync(file, 'utf8'))
)

if (findings.length > 0) {
  console.error(
    `check:tests — ${findings.length} test(s) that pass without proving anything:\n`
  )
  for (const rule of RULES) {
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
  `check:tests — ${files.length} spec files swept, ${RULES.length} rules self-tested, no vacuous test.`
)
