# CLAUDE.md

Guidance for Claude Code (and any contributor) working in this repository.

## What this is

**loupe** — a browser audio practice tool (import a track and work it: waveform,
transport, time-stretch/pitch, markers, A/B loops, zoom, keyboard shortcuts). A
pnpm monorepo with a **pure hexagonal core** + a React (`web`) adapter,
**TDD-strict**, and a blocking quality gate.

## Commands

- `pnpm gate` — **the blocking quality gate**: typecheck → biome → `check:arch`
  (Sheriff) → `check:design`/`check:react` → `check:tokens`/`check:i18n`/`check:sonar`
  → `check:shell` (system shellcheck + actionlint on scripts/hooks/workflows)
  → tests with coverage → knip → jscpd. Run before declaring anything done. A green run
  stamps the tree it validated, so the pre-commit hook doesn't replay it on the
  same bytes (`scripts/gate-stamp.sh`).
- `pnpm test` / `pnpm test:watch` / `pnpm test:coverage` — vitest (`*.spec.ts`,
  colocated). Run one: `pnpm test <path>` (NOT `pnpm test -- <path>` — the `--`
  defeats the filter and the whole suite runs).
- `pnpm test:mutation:diff` — Stryker scoped to the core modules the branch
  touches (`scripts/mutation-diff.ts`). **Run it locally at each close-step,
  before opening the PR** (wired into `/session-report`). The full run
  (`pnpm test:mutation`) stays CI's post-merge job — that one is authoritative.
  Kept out of `gate` (too slow per commit). One heavy run at a time: never
  overlap Stryker with `gate` or a full suite (CPU starvation fails tests) —
  enforced by `.claude/hooks/block-overlapping-heavy-runs.sh`.
- `pnpm sonar` — the SonarCloud findings CI already computed, in the terminal
  (current branch's PR, else `main`; `pnpm sonar <PR#>` targets one). Public
  project, so no token. Read it at each close-step: Sonar catches rules the
  local detectors don't. **False positives are triaged in
  `sonar-project.properties`**, as code, so the reasoning travels with the PR —
  never resolved in the web UI. `check:sonar` (in the gate) fails when an
  exemption names a file that moved: it would stop applying in silence.
- `pnpm typecheck` / `pnpm check` / `pnpm check:fix` / `pnpm check:arch`
  / `pnpm check:dead` / `pnpm check:dup`.
- Run the app: `pnpm dev` (browser shell only — no projects/URL import) or
  `pnpm dev:full` (the full server shell with HMR: Vite with
  `VITE_SHELL=server` proxying `/projects`, `/audio`, `/download`… to a
  `cargo run -p loupe-server` on 6173 — what testers actually use).

## Architecture (hexagonal)

```
packages/
  core/   — pure hexagon, no I/O. src/domain (model) + src/application (use-cases + ports).
            src/index.ts is the only public surface adapters import.
  web/     — React adapter: Web Audio / localStorage / file ports + the workstation UI.
```

Dependency direction: `application → domain`; adapters depend only on `@app/core`'s
public API. Enforced at three levels: the package graph, **Sheriff**
(`sheriff.config.ts`), and **Biome** (`noRestrictedGlobals` + `noRestrictedImports`
override on `packages/core`) for the no-I/O / no-browser-global invariant Sheriff
can't see.

## Invariants — do not violate

1. **Pure, agnostic core.** No I/O, no `window`/`fetch`/`fs`/`process` in the
   algorithms. Values in, values out. Impure code lives in an adapter behind a port.
2. **Outside-in.** The domain is a supplier, pulled into existence by a consumer
   need (a use-case / acceptance test) — never written speculatively.

## Working method

- **TDD strict** (`/tdd-cycle`): red → green → refactor; never write core code
  without a failing test. Property tests (fast-check) for invariants.
- **New feature** = a hexagonal vertical slice (`/new-feature-hexa`): pure domain +
  use-case/port in `core`, adapter in `web`; register it in
  [packages/core/src/application/README.md](packages/core/src/application/README.md).
- **Close every step** with `/session-report` (updates `docs/STATUS.md` + a dated
  report under `docs/sessions/`). Report **and** STATUS/Suivi ship **inside** the
  feature's PR — STATUS phrased merge-invariantly ("step N, delivered by PR
  #NN"), no post-merge doc-only commit.
- **Confirm the approach before coding a UI slice.** When a slice has a mockup or
  an interaction constraint (zoom model, scroll behaviour, layout), state the
  intended approach in 2–3 lines and check it against the mockup **before** writing
  the acceptance test. This is where reworks come from — e.g. a pan-slider zoom
  model shipped instead of the mockup's zoom-scale + native-scroll design.

## Conventions

- Code comments and test names in **English**. File names **kebab-case**.
- **UI copy goes through Lingui** (`packages/web` only) — conventions in
  [packages/web/CLAUDE.md](packages/web/CLAUDE.md), loaded when working there.
- **Conventional Commits** (enforced by commitlint + the husky `commit-msg` hook).
- **Each feature gets its own branch**, merged via PR — never commit a feature
  directly to `main` (enforced by `.claude/hooks/block-commit-on-main.sh`).
  - **Doc-only exception**: a commit whose every change is documentation (`*.md` or
    `docs/**`) may land directly on `main`.
