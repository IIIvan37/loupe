// Mutation testing SCOPED TO THE DIFF: mutate only the core modules the
// current branch touches, so the close-step stays minutes long as the core
// grows. The full run (all modules) remains CI's post-merge job — that run is
// authoritative; this one is the fast local feedback loop.
//
// Run: pnpm test:mutation:diff   (at each close-step, see /session-report)
//
// Scope mapping (a scope = a --mutate glob):
//   - a changed file under core/src/<feature>/ scopes its whole module —
//     test-only changes still re-validate the module they test;
//   - a changed nursery file (core/src/domain|application) scopes both
//     nursery folders (they form one flat module);
//   - shared/ scopes shared/ (mutants there are killed by any covering test,
//     wherever it lives — perTest coverage analysis finds them);
//   - index.ts and testing/ are never mutated (stryker.config.json);
//   - a changed web hook (web/src/**/use-*.ts[x]) is mutated FILE BY FILE —
//     the general altitude detector (revue SOLID, lot 4): a surviving mutant
//     in a hook is exactly the signal « policy untested in values », and the
//     full CI run does not cover web at all;
//   - nothing touched → nothing to mutate, exit 0.

import { spawnSync } from 'node:child_process'

const CORE_PREFIX = 'packages/core/src/'

const sorted = (values: ReadonlySet<string>): string[] =>
  [...values].sort((a, b) => a.localeCompare(b))
const NURSERY = new Set(['domain', 'application'])

function gitLines(args: readonly string[]): string[] {
  const result = spawnSync('git', [...args], { encoding: 'utf8' })
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`)
  }
  return result.stdout.split('\n').filter((line) => line !== '')
}

function mergeBase(): string {
  for (const ref of ['origin/main', 'main']) {
    const result = spawnSync('git', ['merge-base', 'HEAD', ref], {
      encoding: 'utf8'
    })
    if (result.status === 0) return result.stdout.trim()
  }
  throw new Error('no merge base with origin/main nor main')
}

// Committed + staged + unstaged vs the merge base, plus untracked newcomers.
const changed = [
  ...gitLines(['diff', '--name-only', mergeBase()]),
  ...gitLines(['ls-files', '--others', '--exclude-standard'])
]

const WEB_PREFIX = 'packages/web/src/'
const WEB_HOOK = /\/use-[\w-]+\.tsx?$/

const scopes = new Set<string>()
const webHooks = new Set<string>()
for (const file of changed) {
  if (
    file.startsWith(WEB_PREFIX) &&
    WEB_HOOK.test(file) &&
    !file.includes('.spec.')
  ) {
    webHooks.add(file)
    continue
  }
  if (!file.startsWith(CORE_PREFIX) || !file.endsWith('.ts')) continue
  const segment = file.slice(CORE_PREFIX.length).split('/')[0] as string
  if (segment.endsWith('.ts')) continue // root files (index.ts, fitness specs)
  if (segment === 'testing') continue // fakes barrel — never mutated
  if (NURSERY.has(segment)) {
    for (const nursery of NURSERY) scopes.add(nursery)
  } else {
    scopes.add(segment)
  }
}

if (scopes.size === 0 && webHooks.size === 0) {
  console.log(
    'mutation:diff — no core source nor web hook touched, nothing to ' +
      'mutate (the full CI post-merge run stays authoritative).'
  )
  process.exit(0)
}

const globs = [
  ...sorted(scopes).map((scope) => `${CORE_PREFIX}${scope}/**/*.ts`),
  ...sorted(webHooks),
  `!${CORE_PREFIX}**/*.spec.ts`,
  `!${CORE_PREFIX}**/testing/**`
]

const scopeLabel = [...sorted(scopes), ...sorted(webHooks)].join(', ')
console.log(`mutation:diff — scopes: ${scopeLabel}`)
// --force: the incremental cache goes stale on survived mutants (see memory /
// stryker-incremental-stale); a scoped fresh run is both faster and truthful.
const run = spawnSync(
  'pnpm',
  ['exec', 'stryker', 'run', '--force', '--mutate', globs.join(',')],
  { stdio: 'inherit' }
)
process.exit(run.status ?? 1)
