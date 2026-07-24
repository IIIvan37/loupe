# Session — 2026-06-28 — jalon1-web-scaffold

Slice 0 of Jalon 1 (see [docs/jalon-1-plan.md](../jalon-1-plan.md)): stand up the
web adapter package and extend the blocking gate. No domain/feature yet — this is
the foundation the following slices build on.

## Done
- **Kickoff decisions locked** (recorded in [docs/STATUS.md](../STATUS.md) and the plan):
  time-stretch = **Rubber Band** (→ product GPL or commercial, reconfirm before
  Slice 3); web stack = React + Jotai (if needed) · **Base UI** · **Every Layout**
  · **CSS Modules** + CSS-variable tokens · **smart/dumb** components; extra gates =
  **impeccable** + **react-doctor** (blocking, `packages/web` only).
- **`docs/jalon-1-plan.md`** written (source of truth: architecture mapping, ports,
  slice table, per-slice loop incl. `/code-review`).
- **`packages/web` scaffolded** (Vite + React 19 + TS):
  - Design tokens in CSS variables (spec palette, amber/teal semantic rule) +
    fonts (Inter / IBM Plex Mono / Space Grotesk via `@fontsource`).
  - Every Layout primitives `Stack`, `Cluster` (one folder per component).
  - Dumb shell `WorkstationShell` (Header readouts in teal/mono, Base UI Tabs
    analysis panel, amber transport bar) + jsdom component test.
  - `cx()` helper (narrows CSS-module `string | undefined` to `string` for Base
    UI's strict `className`, removes the duplicated class-join pattern).
- **Gate extended** and wired into `pnpm gate`: `check:design` (impeccable),
  `check:react` (react-doctor `--blocking warning --no-telemetry`). Configs updated:
  root `typecheck` runs core/cli + web separately; root `tsconfig` scoped to
  core+cli; web has its own DOM+jsx tsconfig; vitest includes `.spec.tsx` (jsdom
  per-file docblock); sheriff adds `web → core:api`; knip adds the web workspace.
- **Code review (Slice 0 close)**: 1 confirmed bug fixed — dangling `styles.track`
  class reference in the header (class was undefined; passed typecheck silently
  because CSS-module access is `string | undefined`). 1 false positive refuted
  (single-class `cx()` is required by Base UI's strict `className`). 1 low-severity
  note left open (see below).

## Not done / remaining
- **Slice 1** (next): import a local file → render its waveform, outside-in via
  `/new-feature-hexa`. Re-adds `@app/core` as a web dependency (removed here as it
  was unused — outside-in / no speculative deps).
- **Low-severity cleanup note (deferred, deliberate):** the micro-label recipe
  (`0.65rem`, uppercase, `letter-spacing 0.08em`, `--dim`) is duplicated across
  `header.readoutLabel`, `transport-bar.fieldLabel`,
  `workstation-shell.placeholderLabel`. Candidate for a shared utility/token once
  the design system stabilises; below jscpd's threshold so it does not fail the gate.

## Decisions
- Removed speculative scaffolding to honour the **outside-in** invariant: the `Box`
  primitive and the `@app/core` web dependency were unused → deleted; they return
  when a slice pulls them in.
- React-doctor is made **blocking on warnings** (`--blocking warning`, default is
  errors-only) and offline (`--no-telemetry`) to fit the no-debt gate philosophy.
- Per-file `// @vitest-environment jsdom` docblock chosen over a separate vitest
  project, so the pure core stays on the default `node` env with no extra config.

## Gate status
- typecheck: ✅ (core/cli + web)
- tests (with coverage): ✅ 12/12 (3 files); core coverage thresholds met
- mutation (Stryker, local): n/a — Slice 0 touched no `@app/core` code
- biome / sheriff / knip / jscpd: ✅ all green; impeccable ✅, react-doctor ✅
  (97→100 after the dead-file removal). Full `pnpm gate` exits 0.

## State to resume from
- **Single next action**: start **Slice 1** — `/new-feature-hexa`: write the
  `loadTrack` use-case acceptance test (decode bytes via an `AudioFileDecoder`
  port → compute `Waveform` peaks → `Track`), let it pull the domain into
  existence, then implement the `WebAudioDecoder` adapter + canvas `WaveformRenderer`.
- Gotchas:
  - Re-add `@app/core` to `packages/web/package.json` when web first imports it
    (knip will otherwise flag it / fail if added before use).
  - Vite is v8 and Base UI is `1.0.0-rc.0` (release candidate) — pin-watch on upgrades.
  - Branch `chore/jalon1-web-scaffold`; PR opened from it (see STATUS).
