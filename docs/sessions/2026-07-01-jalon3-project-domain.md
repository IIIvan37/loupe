# Session — 2026-07-01 — jalon3-project-domain

## Done
- **Slice J3.1 — pure `Project` domain (outside-in).** Kicks off Jalon 3
  (project persistence). New `packages/core/src/domain/project.ts`:
  - `projectFromSession(session, stamp)` — the single seam that turns a working
    `SessionSnapshot` into a saveable `Project`. Pure: `id`/`name`/`now` are
    **injected** via `ProjectStamp` (the core owns no clock, no id generator);
    `createdAt` and `updatedAt` both start at `now`.
  - Model kept **light**: `Project` = id/name/timestamps + `ProjectSource`,
    `LoopLibrary`, `MarkerList`, optional `ProjectSeparation` (= `ProjectStem[]`
    + `MixerState`). Heavy audio never enters the model — the source and each
    stem hold only an `AudioRef` (opaque pointer a future `ProjectAudioStore`
    resolves to bytes).
  - `separation` is truly optional under `exactOptionalPropertyTypes`: the key is
    **omitted** for an unseparated session (conditional spread), not set to
    `undefined`.
- Reuses existing domain values (`LoopLibrary`, `MarkerList`, `MixerState`) — no
  new copies of loop/marker/mixer shapes.
- Exported the public surface from `packages/core/src/index.ts`; registered the
  slice in `packages/core/src/application/README.md` (pure-domain note).
- Tests: 6 specs incl. a `fast-check` property test (fields preserved by
  reference, timestamps = `now`, id/name stamped) — `project.spec.ts`.

## Not done / remaining
- **J3.2** — application layer: ports `ProjectStore` (light manifest:
  list/load/save/delete) + `ProjectAudioStore` (heavy blobs: put/get by ref) and
  use-cases `saveProject` / `listProjects` / `openProject` (fake in-memory
  adapters, no real backend yet). The mixer↔stems consistency invariant (every
  `MixerState` channel id maps to a `ProjectStem`) is deliberately **not**
  enforced in J3.1 — validate it here if a use-case needs it.
- **J3.3** — real adapter + UI (Save / list / Open). **This is where Tauri vs
  web-server is decided** — it's a `ProjectAudioStore` choice; ~90% of the code
  above it is common.

## Decisions
- **Direction (product): domain-first, backend later.** The persistence backend
  (Tauri desktop FS vs extended HTTP server) is a late, cheap **adapter** choice
  because persistence sits behind a port; the `Project` domain + use-cases are
  identical either way. Decided in J3.3, not now.
- **`localStorage` was never a project store.** It only holds the loop library
  (`LoopStore`, ~KB of JSON) — audio was never persisted. "Projects" is a *new*
  capability (persist heavy audio + session state), not a migration off
  `localStorage`.
- **The separator-server stays single-purpose.** It is a stateless Demucs
  service outside the hexagon; it does not become the project backend.

## Gate status
- typecheck: ✅
- tests (with coverage): ✅ 274 tests pass (core coverage unaffected — new pure
  file fully covered)
- mutation (Stryker, local, core touched): ✅ core 96.49% ≥ 80 threshold;
  **`project.ts` 100.00% (6 killed, 0 survived)**
- biome / sheriff / knip / jscpd: ✅ all green (Sheriff "No issues found";
  knip no orphan — `index.ts` is core's `exports` entry; jscpd 12 clones under
  threshold)

## State to resume from
- **Single next action**: open the J3.1 PR (`gh pr create` from
  `feat/jalon3-project-domain`), then start **J3.2** on a fresh branch —
  outer-loop acceptance test for `saveProject` with fake `ProjectStore` /
  `ProjectAudioStore`, pulling the ports into existence.
- Gotchas / half-done edits: none — working tree is the finished slice
  (README + index + project.ts + project.spec.ts), ready to commit.
