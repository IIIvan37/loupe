// SonarCloud results, pulled into the LOCAL loop.
//
// The analysis already runs in CI (.github/workflows/sonar.yml) on every PR and
// every push to main — but its findings only ever lived in the SonarCloud web
// UI, so the close-step never saw them. Running the scanner locally would cost
// a JVM, a scanner CLI and ~5 min for results CI has already computed; this
// reads those results instead.
//
// The project is public, so the Web API answers anonymously — no token needed.
// SONAR_TOKEN is honoured if present (for a future private project).
//
// Run: pnpm sonar            (current branch's PR, else main)
//      pnpm sonar 296        (an explicit PR number)
//      pnpm sonar main       (the project backlog on main)

import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const HOST = 'https://sonarcloud.io'
const PROJECT = 'IIIvan37_loupe'

// Node's fetch ignores the http(s)_proxy environment variables unless told to
// read them, and the flag is only honoured at startup — behind a proxy every
// request dies on ECONNRESET, which reads like the API is down. Re-exec once
// with the flag on rather than making `NODE_USE_ENV_PROXY=1 node …` the
// documented incantation (that spelling doesn't survive Windows shells).
if (
  (process.env.https_proxy ?? process.env.HTTPS_PROXY) &&
  !process.env.NODE_USE_ENV_PROXY
) {
  const child = spawnSync(
    process.execPath,
    [fileURLToPath(import.meta.url), ...process.argv.slice(2)],
    { stdio: 'inherit', env: { ...process.env, NODE_USE_ENV_PROXY: '1' } }
  )
  process.exit(child.status ?? 1)
}

type Target =
  | { readonly kind: 'pullRequest'; readonly id: string }
  | { readonly kind: 'branch'; readonly id: string }

type Condition = {
  readonly metricKey: string
  readonly status: string
  readonly actualValue?: string
  readonly errorThreshold?: string
  readonly comparator?: string
}

type Issue = {
  readonly component: string
  readonly line?: number
  readonly rule: string
  readonly severity: string
  readonly type: string
  readonly message: string
}

type Hotspot = {
  readonly component: string
  readonly line?: number
  readonly securityCategory: string
  readonly vulnerabilityProbability: string
  readonly message: string
}

/** The PR the current branch belongs to, if gh can tell us. */
function currentPullRequest(): string | null {
  const result = spawnSync(
    'gh',
    ['pr', 'view', '--json', 'number', '-q', '.number'],
    {
      encoding: 'utf8'
    }
  )
  const number = result.status === 0 ? result.stdout.trim() : ''
  return /^\d+$/.test(number) ? number : null
}

function resolveTarget(argument: string | undefined): Target {
  if (argument !== undefined) {
    return /^\d+$/.test(argument)
      ? { kind: 'pullRequest', id: argument }
      : { kind: 'branch', id: argument }
  }
  const pr = currentPullRequest()
  return pr === null
    ? { kind: 'branch', id: 'main' }
    : { kind: 'pullRequest', id: pr }
}

type ProjectStatusResponse = {
  readonly projectStatus: {
    readonly status: string
    readonly conditions?: readonly Condition[]
  }
}

async function api<T>(
  path: string,
  parameters: Record<string, string>
): Promise<T> {
  const url = new URL(`${HOST}/api/${path}`)
  for (const [key, value] of Object.entries(parameters))
    url.searchParams.set(key, value)

  const token = process.env.SONAR_TOKEN
  const response = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  })
  if (!response.ok) {
    throw new Error(
      `${url.pathname} → HTTP ${response.status} ${await response.text()}`
    )
  }
  // The Web API's shapes are contractual and far wider than the handful of
  // fields read here; the local types are the subset this script relies on.
  return (await response.json()) as T
}

/** `IIIvan37_loupe:packages/web/src/x.ts` → `packages/web/src/x.ts`. */
const filePath = (component: string): string =>
  component.replace(`${PROJECT}:`, '')

const location = (component: string, line?: number): string =>
  line === undefined ? filePath(component) : `${filePath(component)}:${line}`

function reportQualityGate(conditions: readonly Condition[]): void {
  const failed = conditions.filter((condition) => condition.status !== 'OK')
  if (failed.length === 0) {
    console.log('   all conditions met')
    return
  }
  for (const condition of failed) {
    console.log(
      `   ✗ ${condition.metricKey}: ${condition.actualValue} (threshold ${condition.errorThreshold})`
    )
  }
}

function reportIssues(issues: readonly Issue[]): void {
  if (issues.length === 0) {
    console.log('   none')
    return
  }
  // Grouped by file: a rule usually fires several times in the same place, and
  // the fix is one visit to that file.
  const byFile = new Map<string, Issue[]>()
  for (const issue of issues) {
    const key = filePath(issue.component)
    byFile.set(key, [...(byFile.get(key) ?? []), issue])
  }
  for (const [file, fileIssues] of [...byFile].sort(([a], [b]) =>
    a.localeCompare(b)
  )) {
    console.log(`   ${file}`)
    for (const issue of fileIssues) {
      const at = issue.line === undefined ? '' : `:${issue.line}`
      console.log(
        `     ${at.padEnd(6)} ${issue.severity.padEnd(8)} ${issue.rule}  ${issue.message}`
      )
    }
  }
}

function reportHotspots(hotspots: readonly Hotspot[]): void {
  if (hotspots.length === 0) {
    console.log('   none to review')
    return
  }
  for (const hotspot of hotspots) {
    console.log(
      `   ${hotspot.vulnerabilityProbability.padEnd(6)} ${location(hotspot.component, hotspot.line)}  ${hotspot.message}`
    )
  }
}

const target = resolveTarget(process.argv[2])
const scope = { [target.kind]: target.id }
const label =
  target.kind === 'pullRequest' ? `PR #${target.id}` : `branch ${target.id}`

console.log(`\nSonarCloud — ${PROJECT} · ${label}\n`)

let status: ProjectStatusResponse
try {
  status = await api<ProjectStatusResponse>('qualitygates/project_status', {
    projectKey: PROJECT,
    ...scope
  })
} catch (error) {
  // A branch with no PR (or a PR whose analysis hasn't landed yet) simply has
  // no report — that is an answer, not a crash.
  console.log(
    `No analysis for this ${target.kind === 'pullRequest' ? 'PR' : 'branch'} yet.`
  )
  console.log(
    'CI analyses pull requests and pushes to main; give it ~5 min after a push.'
  )
  console.log(`(${(error as Error).message.split('\n')[0]})`)
  process.exit(0)
}

const [issuesPayload, hotspotsPayload] = await Promise.all([
  api<{ readonly issues?: readonly Issue[] }>('issues/search', {
    componentKeys: PROJECT,
    resolved: 'false',
    ps: '100',
    ...scope
  }),
  api<{ readonly hotspots?: readonly Hotspot[] }>('hotspots/search', {
    projectKey: PROJECT,
    status: 'TO_REVIEW',
    ps: '100',
    ...scope
  })
])

const issues = issuesPayload.issues ?? []
const hotspots = hotspotsPayload.hotspots ?? []

console.log(`Quality gate: ${status.projectStatus.status}`)
reportQualityGate(status.projectStatus.conditions ?? [])

console.log(`\nOpen issues (${issues.length}):`)
reportIssues(issues)

console.log(`\nSecurity hotspots to review (${hotspots.length}):`)
reportHotspots(hotspots)

console.log(`\n${HOST}/project/issues?id=${PROJECT}\n`)

// Reporting, not gating: these results describe a CI run of a possibly older
// commit, so they must never fail a local command. The close-step reads them.
process.exit(0)
