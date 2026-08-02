// check:shell — the shell layer gets a linter like every other language here.
// ~430 lines of bash carry the gate stamp, the blocking hooks and the release
// packaging; the only real delivery breakage so far came from that layer, and
// none of it was linted. Two sweeps:
//   - shellcheck on every tracked shell script (scripts/, .claude/hooks/,
//     .husky/ — the husky hooks carry a #!/bin/sh shebang). SYSTEM tool on
//     purpose: the npm wrapper was dropped for shipping a critical unpatched
//     advisory (decompress, GHSA-mp2f-45pm-3cg9) into the blocking audit.
//     Preinstalled on the ubuntu/macos runner images but NOT on
//     windows-latest (2025 image) — ci.yml installs it there via choco;
//   - actionlint on the GitHub workflows (github-actionlint wraps the
//     official binary; adm-zip pinned >=0.6.0 via pnpm.overrides) —
//     expressions, contexts, permissions, runner labels, and the embedded
//     `run:` snippets via its shellcheck integration when found on PATH.
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

const shellScripts = [
  ...trackedFiles('*.sh'),
  ...trackedFiles('.husky/pre-commit'),
  ...trackedFiles('.husky/commit-msg')
]
const shellcheck = spawnSync('shellcheck', ['--', ...shellScripts], {
  stdio: 'inherit'
})
if (shellcheck.error !== undefined) {
  console.error(
    'check:shell — shellcheck introuvable sur le PATH. Installer :\n' +
      '  macOS   brew install shellcheck\n' +
      '  Linux   apt-get install shellcheck\n' +
      '  Windows choco install shellcheck\n' +
      '(préinstallé sur les runners GitHub ubuntu/macos ; sur windows-latest,\n' +
      'ci.yml l’installe via choco)'
  )
  process.exit(1)
}

// The wrapped official binary, spawned through its node shim (works the same
// on macOS, Linux and Windows). No file arguments: actionlint discovers
// .github/workflows on its own.
const actionlint = spawnSync(
  process.execPath,
  [require.resolve('github-actionlint/dist/bin/actionlint.js')],
  { stdio: 'inherit' }
)

if (shellcheck.status !== 0 || actionlint.status !== 0) {
  console.error(
    `\ncheck:shell — échec (shellcheck: ${shellcheck.status === 0 ? 'ok' : 'findings'}, actionlint: ${actionlint.status === 0 ? 'ok' : 'findings'})`
  )
  process.exit(1)
}
console.log(
  `check:shell — ok (${shellScripts.length} scripts shell + workflows)`
)
