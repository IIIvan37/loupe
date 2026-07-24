# Session — 2026-07-06 — tempo-octave-toggle (Lot A)

First lot of the tempo-detection upgrade (plan:
[docs/tempo-detection-plan.md](../tempo-detection-plan.md)). Manual ×2 / ÷2
octave correction — fixes the common octave error (detection locking to the
eighth note, reporting double tempo).

## Done
- **Core (pure, TDD):** `foldTempoOctave(tempo, factor, beatsPerBar?)` in
  [packages/core/src/domain/tempo.ts](../../packages/core/src/domain/tempo.ts) —
  ÷2 drops every other beat, ×2 inserts each midpoint, rescales the bpm and
  rebuilds the grid. New `OctaveFactor` / `TempoValue` types, exported from the
  core public surface.
- **Persistence:** `ProjectTempo.octaveShift?` (core), threaded through
  `liveTempo` / `liveSignature` and the restore path; added to `sessionSignature`
  (absent ⇔ neutral 0, so reopened old manifests still sign « Enregistré »). The
  fold is the first **user-editable** tempo state — bpm/grid stay out of the
  signature, the octave shift stands in for the fold.
- **Mixer:** new `replaceStem(stem, source)` primitive — swaps one stem's PCM +
  lane peaks in a single op, no channel dispatch, so fader/mute/solo survive (the
  engine keeps the gain by id across the remove/add).
- **Metronome:** `reseat(grid, audio)` re-renders the click for the folded grid
  via `replaceStem`, leaving every other stem untouched.
- **Tempo hook:** `fold(factor)` (clamped to ±2, returns folded analysis for the
  caller to re-seat), `octaveShift` state, `set(analysis, shift?)` for restore;
  a fresh `detect` clears the fold to 0.
- **UI:** ÷2 / ×2 buttons in
  [tempo-panel.tsx](../../packages/web/src/app/tempo/tempo-panel.tsx) (disabled at
  the ±2 bound), wired via `onFoldTempo` in the shell → `tempo.fold` +
  `metronome.reseat`. New Lingui ids `tempo.halve` / `tempo.double`, catalog
  extracted.
- Tests: core domain (6, one per rule), signature (2), mixer (2), metronome (1),
  tempo hook (5), new component spec (5), restore round-trip (1).

## Not done / remaining
- **Lot B** — enriched `/tempo` contract (`beats: [{time, position}]`), downbeat
  detection via `beat_this` on the server, `buildBeatGrid` rewrite to use
  `barPosition`, meter display. Adapt `foldTempoOctave` to the enriched beats.
- **Lot C** — tempo-map (variable tempo).
- `beat_this` verified green (MIT code+weights, torch≥2/numpy≥1.20, in-memory
  `Audio2Beats`, ~78 MB or 8 MB `small0`) — see the plan doc.

## Decisions
- Octave fix ships as a **manual toggle** (reliable escape hatch) rather than a
  server-only heuristic — the musician always knows. The server-side prior stays
  for Lot B via `beat_this`.
- Persist the **already-folded** bpm/grid + an explicit `octaveShift` (not raw
  bpm in the signature, which would spuriously dirty re-detected old manifests).
- Downbeat phase after a fold is naive (rebuilt from beat 0) — acceptable for
  Lot A; real downbeats come with `beat_this` in Lot B.

## Gate status
- typecheck: ✅
- tests (with coverage): ✅ 617 passed / 71 files; core domain 100%, tempo hook
  97.5%.
- mutation (Stryker, local, core touched): ✅ overall 94.89% ≥ 80; new
  `tempo.ts` **100%** (31 mutants, 0 survived), `project.ts` / `detect-tempo.ts`
  100%.
- biome / sheriff / knip / jscpd: ✅ (jscpd clones are all pre-existing, none in
  the new files).

## State to resume from
- **Single next action**: open the PR for `feat/tempo-octave-toggle`, then start
  **Lot B** — enrich the `/tempo` contract with per-beat `barPosition` and swap
  the server DSP to `beat_this` (behind the existing librosa 503 fallback).
- Gotchas / half-done edits: none — branch is clean, gate green. `foldTempoOctave`
  will need a small adaptation in Lot B once beats carry `barPosition` (the fold
  currently rebuilds the grid from beat 0).
