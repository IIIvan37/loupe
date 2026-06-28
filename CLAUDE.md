# CLAUDE.md

Guidance for Claude Code (and any contributor) working in this repository.

## What this is

**loupe** — a browser audio practice tool (import a track and work it: waveform,
transport, time-stretch/pitch, markers, A/B loops, zoom, keyboard shortcuts). A
pnpm monorepo with a **pure hexagonal core** + a React (`web`) adapter,
**TDD-strict**, and a blocking quality gate.

## Commands

- `pnpm gate` — **the blocking quality gate**: typecheck → biome → `check:arch`
  (Sheriff) → tests with coverage → knip → jscpd. Run before declaring anything done.
- `pnpm test` / `pnpm test:watch` / `pnpm test:coverage` — vitest (`*.spec.ts`,
  colocated). Run one: `pnpm test -- <path-or-name>`.
- `pnpm test:mutation` — Stryker, scoped to `@app/core`. **Run it locally at each
  close-step, before opening the PR** (wired into `/session-report`). Also runs in
  CI post-merge. Kept out of `gate` (too slow per commit).
- `pnpm typecheck` / `pnpm check` / `pnpm check:fix` / `pnpm check:arch`
  / `pnpm check:dead` / `pnpm check:dup`.
- Run the app: `pnpm --filter @app/web dev`.

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
  report under `docs/sessions/`). The report ships **inside** the feature's PR.

## Conventions

- Code comments and test names in **English**. File names **kebab-case**.
- **Conventional Commits** (enforced by commitlint + the husky `commit-msg` hook).
- **Each feature gets its own branch**, merged via PR — never commit a feature
  directly to `main` (enforced by `.claude/hooks/block-commit-on-main.sh`).
  - **Doc-only exception**: a commit whose every change is documentation (`*.md` or
    `docs/**`) may land directly on `main`.
