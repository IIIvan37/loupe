# loupe

[![Quality gate](https://sonarcloud.io/api/project_badges/measure?project=IIIvan37_loupe&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=IIIvan37_loupe)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=IIIvan37_loupe&metric=coverage)](https://sonarcloud.io/summary/new_code?id=IIIvan37_loupe)
[![Maintainability](https://sonarcloud.io/api/project_badges/measure?project=IIIvan37_loupe&metric=sqale_rating)](https://sonarcloud.io/summary/new_code?id=IIIvan37_loupe)
[![Duplications](https://sonarcloud.io/api/project_badges/measure?project=IIIvan37_loupe&metric=duplicated_lines_density)](https://sonarcloud.io/summary/new_code?id=IIIvan37_loupe)

A browser audio practice tool — import a track and work it: waveform with
click-to-seek, transport, time-stretch and pitch (SoundTouch), markers, A/B loops
(the « loupe »), zoom, keyboard shortcuts, and **AI stem separation** (isolate
voice/drums/bass/other). Built as a **pnpm monorepo** with a **pure hexagonal
core**, **strict TDD**, and a **blocking quality gate**.

**User guide (features, install, shortcuts — in French):**
[docs/guide-utilisateur.md](docs/guide-utilisateur.md)

**Found a bug during the beta?**
[Open an issue](https://github.com/IIIvan37/loupe/issues/new) with your OS,
the version (`loupe --version`) and what you were doing.

## Architecture

- **`@app/core`** — the pure hexagon. `src/domain` (model) + `src/application`
  (use-cases + ports). No I/O, no browser globals; values in, values out.
  `src/index.ts` is the only public surface adapters import.
- **`packages/web`** — the React adapter: Web Audio / localStorage / file ports
  behind the core's interfaces, smart hooks + dumb components, the workstation UI.
- **`crates/`** — the distribution (D4): `loupe-server`, the Rust binary that
  serves the built web app and the project/download endpoints locally (one
  file, zero runtime), and `loupe-download`, its yt-dlp engine. The `loupe`
  binary is the **nominal way to run loupe**; heavy analysis is offloaded to
  **Modal**.
- **`server/`** — the **analysis library the Modal deployment imports**, plus
  its local dev/CI harness (FastAPI, PyTorch, GPU-capable), deliberately
  outside the monorepo/hexagon. **Analysis only** (`/separate`, `/tempo`,
  `/chords`, `/structure`) — project storage, URL download and web serving
  live in the `loupe` binary. `server/app/` holds the pure inference/guard
  logic the pytest suite locks and Modal runs in production.
  See [server/README.md](server/README.md).

Layering is enforced three ways: the package graph (`@app/core` pure ← `web`
adapter), **Sheriff** (`sheriff.config.ts`) on the module graph, and **Biome**
`noRestricted*` (override on `packages/core`) for the no-I/O / no-browser-global
purity invariant Sheriff can't see.

## Commands

```sh
corepack enable
pnpm install
pnpm --filter @app/web dev       # run the workstation in a browser (dev)
pnpm gate                        # the blocking quality gate (run before any commit)
```

The distributed `loupe` binary (see `docs/RELEASING.md`) is the nominal way to
run loupe; the Python analysis server is optional (`pnpm dev:analysis` — the
dev/CI harness of the library Modal deploys, see Architecture).

- **`pnpm gate`** — TypeScript strict, Biome lint+format, Sheriff, vitest with
  coverage thresholds (core), knip (dead code), jscpd (duplication), plus
  `impeccable` + `react-doctor` on the web package. Greenfield: a finding fails it.
- **`pnpm test`** / `test:watch` / `test:coverage` — vitest (`*.spec.ts(x)`,
  colocated).
- **`pnpm test:mutation`** — Stryker, scoped to `@app/core`; run locally before a
  PR (also runs in CI post-merge).

## AI disclosure

This project is developed with AI assistance (Claude Code, Anthropic) under
human direction: the product decisions, the architecture invariants and the
merge button stay human. Every change goes through the same discipline
regardless of who typed it — strict TDD, the blocking quality gate below,
mutation testing on the core, SonarCloud, and human review of every PR. The
repo doubles as a lab for that working method; the skills under
`.claude/skills` are part of the experiment.

## Method

- **TDD strict** (`/tdd-cycle`): red → green → refactor; the core is never written
  without a failing test. Property tests (fast-check) for invariants.
- **New feature = a hexagonal vertical slice** (`/new-feature-hexa`): pure
  domain + use-case/port in `core`, adapter in `web`; registered in
  [packages/core/src/application/README.md](packages/core/src/application/README.md).
- **Close every step** with `/session-report` (updates `docs/STATUS.md` + a dated
  report under `docs/sessions/`); the report ships inside the feature's PR.
- **Guardrails**: husky `pre-commit` (gate) + `commit-msg` (commitlint), a
  `block-commit-on-main` hook (code needs a branch + PR; docs may go straight to
  main). CI runs the gate + commitlint on PRs, mutation post-merge.

## Layout

```
packages/core/src/domain        pure model
packages/core/src/application   use-cases + ports (the registry README lives here)
packages/core/src/index.ts      the only public surface adapters import
packages/web/src                the React adapter + workstation UI
crates                          the `loupe` binary (local server + embedded web) and its yt-dlp engine
server                          the analysis library Modal deploys + its dev/CI harness (off the nominal path)
.claude/skills                  the method, as Claude Code skills
docs/STATUS.md, docs/sessions   resumable project state
```
