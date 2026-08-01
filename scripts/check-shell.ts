// check:shell — the shell layer gets a linter like every other language here.
// ~430 lines of bash carry the gate stamp, the blocking hooks and the release
// packaging; the only real delivery breakage so far came from that layer, and
// none of it was linted. Two sweeps, both hermetic (npm-managed tools, no
// system dependency):
//   - shellcheck on every tracked shell script (scripts/, .claude/hooks/,
//     .husky/ — the husky hooks carry a #!/bin/sh shebang);
//   - actionlint on the GitHub workflows (github-actionlint wraps the
//     official binary) — expressions, contexts, permissions, runner labels,
//     and the embedded `run:` snippets via the shellcheck integration
//     (node_modules/.bin is on PATH under pnpm, so actionlint finds it).
//
// Run: pnpm check:shell (part of `pnpm gate`).

import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

const trackedFiles = (pattern: string): string[] => {
  const result = spawnSync('git', ['ls-files', '--', pattern], {
    encoding: 'utf8'
  })
  if (result.status !== 0) {
    throw new Error(`git ls-files failed: ${result.stderr}`)
  }
  return result.stdout.split('\n').filter((line) => line !== '')
}

// Both tools ship as node shims around a platform binary — spawning the shim
// through process.execPath works identically on macOS, Linux and Windows.
const runShim = (shim: string, args: string[]): number => {
  const result = spawnSync(process.execPath, [require.resolve(shim), ...args], {
    stdio: 'inherit'
  })
  return result.status ?? 1
}

const shellScripts = [
  ...trackedFiles('*.sh'),
  ...trackedFiles('.husky/pre-commit'),
  ...trackedFiles('.husky/commit-msg')
]
const shellcheckStatus = runShim('shellcheck/bin/shellcheck.js', [
  '--',
  ...shellScripts
])

// No file arguments: actionlint discovers .github/workflows on its own.
const actionlintStatus = runShim('github-actionlint/dist/bin/actionlint.js', [])

if (shellcheckStatus !== 0 || actionlintStatus !== 0) {
  console.error(
    `\ncheck:shell — échec (shellcheck: ${shellcheckStatus === 0 ? 'ok' : 'findings'}, actionlint: ${actionlintStatus === 0 ? 'ok' : 'findings'})`
  )
  process.exit(1)
}
console.log(
  `check:shell — ok (${shellScripts.length} scripts shell + workflows)`
)
