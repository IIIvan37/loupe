# Session — 2026-06-28 — jalon2-separation-screen

> Slice **J2.1** of Jalon 2 (« Séparation IA »). Kickoff plan landed on `main`
> first (doc-only): [docs/jalon-2-plan.md](../jalon-2-plan.md). This report ships
> inside the slice PR.

## Done
- **Kickoff Jalon 2** (already on `main`, `d10557a`): `docs/jalon-2-plan.md`
  (6-slice breakdown) + STATUS. Locked: separation behind a pure `StemSeparator`
  port, **WASM client-side as the first adapter** (Loupe stays backend-free; cloud
  API = a future second adapter); découpe = N adaptive tracks + grouping; export
  tier A.
- **Slice J2.1 — separate the loaded track into stems** (UI-first, stub separator):
  - **core (TDD + mutation):** `separateTrack` use-case + `StemSeparator` /
    `SeparatedStem` / `SeparationProgress` driven port; `SeparationState` reducer
    (`idle → analysing → separating → ready | error`, clamped progress);
    `StemSet` / `StemTrack` with `buildStemTrack` reusing the track mono-mix →
    waveform reduction. Public surface exported from `index.ts`; registry updated.
  - **Shared input, no second import:** `loadTrack` now also returns the decoded
    `audio`, so separation reuses the SAME PCM the player loaded (per user feedback
    — the input is the transcribe-clone's input). `usePlayer` retains it
    (`loadedAudio`).
  - **web adapter:** `createStubSeparator` (believable progress curve, returns the
    five reserved stem colours reusing the loaded PCM); `useSeparation` smart hook
    (runs `separateTrack`, streams progress into the reducer, **run-id guard**
    against a stale run landing on a new track); `SeparationPanel` dumb component
    (action on the loaded track → progress → stem list, native `<progress>`,
    teal/stem-colour tokens). Wired into the shell, replacing the static
    « Pistes séparées » placeholder; separation resets on a new import.
- **Code review (high effort, multi-angle):** 1 real bug found & fixed — a slow
  separation resolving after a new import/reset would dispatch `ready`/`fail` and
  show the old track's stems. Fixed with a monotonic run-id (mirrors `usePlayer`'s
  `importIdRef`); covered by `use-separation.spec.tsx`. Other candidates refuted
  (e.g. `fail` keeps stems — but `start` always clears first; `clampFraction`
  mirrors `transport.ts`'s private `clampPosition`).

## Not done / remaining
- **Slice J2.2** — real WASM separator (Demucs, off-main-thread worker) behind the
  same `StemSeparator` port; real progress + memory/error handling. The stub stems
  reuse the input PCM (no real isolation yet).
- Slices J2.3 (adaptive tracks / detection), J2.4 (mixer), J2.5 (grouping),
  J2.6 (export tier A) — see the plan.
- The stub's two equivalent clamp-boundary mutants in `separation.ts` are the only
  survivors (unkillable, like `transport.ts`/`viewport.ts`).

## Decisions
- **Separation engine: pure `StemSeparator` port, WASM-first adapter.** Loupe stays
  backend-free this jalon; cloud API is a future second adapter on the same port,
  no domain change. (Resolved the plan-produit §5 open question « API d'abord —
  laquelle ? » in favour of WASM-first.)
- **Separation reuses the player's decoded PCM** (no second import / no re-decode):
  `loadTrack` returns `audio`; the screen acts on the loaded track.
- **First slice is UI-first on a stub** so the port contract and the
  import → separation → tracks flow are built and reviewed before the WASM cost.

## Gate status
- typecheck: **pass**.
- tests (with coverage): **pass** — 184 tests, 29 files.
- mutation (Stryker, local, core touched): **95.99%** overall; `separate-track.ts`
  & `stem-set.ts` **100%**, `separation.ts` **93.94%** (2 equivalent clamp-boundary
  survivors). The review fix was web-only (core unchanged since).
- biome / sheriff / knip / jscpd: **pass** (jscpd reports 7 CSS/test clones, all the
  pre-existing per-panel button/label pattern, under threshold — gate exit 0).
- impeccable + react-doctor (web): **pass** (progress bar switched to native
  `<progress>` for a11y; run-id guard rephrased to satisfy the await-then-guard
  rule).

## State to resume from
- **Single next action**: **PR #16** is open for `feat/jalon2-separation-screen`
  (2 code commits + this report) — once merged, start **Slice J2.2** (real WASM
  separator) on a fresh branch via `/new-feature-hexa`: implement `StemSeparator`
  with Demucs WASM in a worker; the port contract is already fixed.
- Gotchas: the stub returns stems that REUSE the input PCM — per-stem waveforms are
  identical until J2.2 produces real isolation. `useSeparation` uses a `runIdRef`
  staleness guard; keep it when swapping in the real adapter.
