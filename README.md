# loupe

A browser audio practice tool — import a track and work it: waveform with
click-to-seek, transport, time-stretch and pitch (SoundTouch), markers, A/B loops
(the « loupe »), zoom, keyboard shortcuts, and **AI stem separation** (isolate
voice/drums/bass/other). Built as a **pnpm monorepo** with a **pure hexagonal
core**, **strict TDD**, and a **blocking quality gate**.

## Architecture

- **`@app/core`** — the pure hexagon. `src/domain` (model) + `src/application`
  (use-cases + ports). No I/O, no browser globals; values in, values out.
  `src/index.ts` is the only public surface adapters import.
- **`packages/web`** — the React adapter: Web Audio / localStorage / file ports
  behind the core's interfaces, smart hooks + dumb components, the workstation UI.
- **`packages/desktop`** — the **nominal client**: a **Tauri 2** shell around the
  web app. Projects live on the local filesystem (T2.2), URL import runs a managed
  yt-dlp binary in-process (T2.3), and the heavy analysis is offloaded to **Modal**.
  Nothing local is required to run it.
- **`server/`** — a standalone **FastAPI** backend (PyTorch, GPU-capable),
  deliberately outside the monorepo/hexagon. **No longer on the nominal path**
  (T2.5): it stays as the dev/CI target and, above all, as the **shared library
  the Modal deployment imports** — `server/app/` holds the pure inference/guard
  logic the pytest suite locks and Modal runs in production. In a browser (not the
  desktop shell) the web app's `'http'` adapters still talk to a local instance.
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
pnpm --filter @app/desktop dev   # run the desktop shell (needs web on :5173)
pnpm gate                        # the blocking quality gate (run before any commit)
```

The desktop shell is the nominal way to run loupe; the local FastAPI server is
optional (dev/CI + the library Modal deploys — see Architecture).

- **`pnpm gate`** — TypeScript strict, Biome lint+format, Sheriff, vitest with
  coverage thresholds (core), knip (dead code), jscpd (duplication), plus
  `impeccable` + `react-doctor` on the web package. Greenfield: a finding fails it.
- **`pnpm test`** / `test:watch` / `test:coverage` — vitest (`*.spec.ts(x)`,
  colocated).
- **`pnpm test:mutation`** — Stryker, scoped to `@app/core`; run locally before a
  PR (also runs in CI post-merge).

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
packages/desktop                the Tauri 2 desktop shell (nominal client)
server                          FastAPI backend — dev/CI + the library Modal deploys (off the nominal path)
.claude/skills                  the method, as Claude Code skills
docs/STATUS.md, docs/sessions   resumable project state
```
