---
name: quality-gate
description: Run the blocking quality gate (typecheck + biome + core-purity + tests with coverage + knip dead-code + jscpd duplication) and report. Use before declaring any change done, before a commit, or before opening a PR. Detectors are BLOCKING (greenfield, no debt to absorb) — a finding fails the gate.
---

# Quality gate

Single command, all guardrails, blocking. Unlike a ratchet/report-only setup, a
finding means the change is **not done**. Fix it, don't note it.

## Run

```
pnpm gate
```

`gate` runs, in order (parallelized by pnpm's script regex):

1. `pnpm typecheck` — `tsc --noEmit`, strict (all `noUnused*`,
   `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), plus
   `erasableSyntaxOnly`: the strip-only invariant (no `enum`, no parameter
   properties, no `namespace`, no decorators) is rejected by the compiler
   anywhere in the tree — even in a file no import reaches yet.
2. `pnpm check` — biome lint + format.
3. `pnpm check:arch` — `sheriff verify`: hexagonal layering on the module graph
   (`core:domain` → nothing, `application` → `domain`, `cli` → `core:api`). Browser
   globals and `node:*` imports in the core are caught by Biome (step 2, override on
   `packages/core`), not by Sheriff.
4. `pnpm check:design` / `pnpm check:react` — impeccable + react-doctor
   (blocking, `packages/web` only).
4bis. `pnpm check:tokens` / `pnpm check:i18n` / `pnpm check:sonar` — CSS token,
   Lingui catalog and Sonar-triage fitness functions. `check:sonar` fails when
   a false-positive exemption in `sonar-project.properties` names a file that
   moved — the exemption would stop applying in silence and a settled finding
   would come back as new. `check:i18n` re-extracts the catalog and fails on a diff:
   copy edited in a component but never extracted keeps shipping the OLD French
   string, and nothing else in the gate reads the `.po`. On failure the catalog
   has already been re-extracted for you — review and `git add` it.
5. `pnpm test:coverage` — vitest with coverage thresholds on `packages/core`.
   Locally the worker pool is capped to a third of the cores (`vitest.config.ts`):
   at full width the run starves the box and specs fail on contention, not on a
   defect. CI keeps the default.
6. `pnpm check:dead` — knip (orphan exports / dead code). Caveat: `@app/core`'s
   `index.ts` is the package entry, so a **core public export with no consumer
   yet is NOT flagged** — the application README registry and review are the
   guard there.
7. `pnpm check:dup` — jscpd (copy-paste). Blocking via the **threshold ratchet**
   in `.jscpd.json` (max duplicated-lines %, spec files excluded): the gate
   fails when duplication grows past the budget. Lower the threshold as clones
   get factored out — never raise it.

Individual pieces if needed: `pnpm typecheck`, `pnpm check:fix` (biome auto-fix),
`pnpm check:arch`, `pnpm test`, `pnpm check:dead`, `pnpm check:dup`.

A green run **stamps the working tree it validated** (`scripts/gate-stamp.sh`).
The pre-commit hook replays the checks only when the tree no longer hashes to
that stamp — so `pnpm gate` then `git commit` on the same bytes costs the gate
once instead of twice (measured: ~2 min, against 1.4 s on a stamp hit;
`test:coverage` is ~99 s of it and dominates everything else). Any edit in
between, including biome's own rewrite, misses the stamp and the full set runs.

## How to read / react

- **typecheck**: zero tolerance. No `as any` to silence — fix the type.
- **check:arch / biome**: a Sheriff violation = a layering leak (bad dependency
  between layers). A Biome `noRestricted*` violation = I/O or a global that slipped
  into `core`. Move the impure code into an adapter behind a port. To add/adjust a
  boundary rule: `sheriff.config.ts` (tags + depRules).
- **knip**: an orphan export = either wire it or delete it. No dead code "just in
  case".
- **check:i18n**: never "fix" it by reverting the catalog — the diff IS the
  change you made to the copy. Read it (a stray message, an id renamed by
  accident, a component deleted), then stage it.
- **jscpd**: a clone demands a DECISION, not automatically a merge — three
  exits: **factor** (same knowledge, changes together — often pure domain),
  **mark deliberate** (`// jscpd:ignore-start`/`-end` + a one-line reason —
  coincidental likeness, or a boundary crossing like domain type vs adapter
  DTO), or **when unsure, keep the duplication** — the wrong abstraction costs
  more than the clone (Metz). A threshold failure means the new code added
  duplication past the budget — factor it out rather than bumping
  `.jscpd.json`; never `ignore` without the reason line.

## Before declaring done

- The gate is **green** (exit 0).
- Core coverage holds the thresholds (`vitest.config.ts`).
- If the step is finished (not just verified), close it with `/session-report`.
