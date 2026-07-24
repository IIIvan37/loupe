# Session — 2026-06-30 — jalon2-instrument-detection

Slice **J2.3** — adaptive instrument detection: the separator emits a fixed
roster of stems, but a track rarely uses them all; detection masks the
near-silent ones and shows each kept stem with a machine confidence.

## Done
- **Core — pure detection domain** (`domain/instrument-detection.ts`, new):
  - `stemEnergy(channels)` — RMS loudness over every sample of every channel
    (silence / empty → 0).
  - `detectInstruments(energies)` — confidence = a stem's energy relative to the
    loudest (loudest = 1, all-silent mix = 0), `present` once that share reaches
    `PRESENCE_THRESHOLD` (0.05). Verdicts come back in input order.
  - Specs incl. fast-check properties (energy ≤ peak; loudest kept iff any
    energy; confidence ∈ [0, 1]).
- **Core — `StemTrack` carries the verdict**: `buildStemTrack` now takes a
  `detection` (`confidence` + `present`); `StemTrack` exposes both.
- **Core — `separateTrack` wiring**: after the separator returns, the use-case
  runs `stemEnergy` + `detectInstruments` over the sources (same order) and
  annotates every `StemTrack`. New surface exported from `index.ts`
  (`stemEnergy`, `detectInstruments`, `PRESENCE_THRESHOLD`, `DetectedStem`,
  `StemEnergy`); application README updated.
- **Web — `SeparationPanel`**: split the ready result into a `ReadyStems`
  sub-component — present stems listed with a **teal mono confidence badge**
  (`NN %`, machine = teal per the design tokens) + WAV download; absent stems
  **masked** from the list and named on a single muted **« Non détectés »** line.
  CSS: `.confidence`, `.undetected`, `.undetectedLabel`.
- **Server — switched default model to `htdemucs_6s`** (`separator-server`):
  splits **guitar** and **piano** out of "other", which is what makes adaptive
  detection worthwhile. Added `guitar → guitare/Guitare` and
  `piano → claviers/Claviers` to `STEM_META`, extended `DISPLAY_ORDER`, updated
  the README. `DEMUCS_MODEL` still overrides (e.g. `htdemucs` for the faster
  4-stem model). The web already reserved the `guitare`/`claviers` colour tokens.

## Not done / remaining
- **Browser/real-model verification of `htdemucs_6s` pending** — the model
  change is config-only and untested against the running server (first run
  downloads new ~hundreds-of-MB weights). Verify a real separation surfaces
  guitar/piano and that detection masks absent ones when the server is next run.
- Per-stem **in-app playback** (multitrack mixer) is still the other open J2.x
  thread — roadmap **J2.4**.

## Decisions
- **Confidence is a heuristic from relative energy**, not a model probability
  (the server returns none). Documented as such; loudest stem is always 1.
- **`htdemucs_6s` is the default separation model** (was `htdemucs`). Trade-off
  accepted: slower + the piano stem is weaker/experimental, but guitar + piano
  granularity is the payoff for adaptive detection. Same research-only weights
  caveat as before (non-commercial tool only).

## Gate status
- typecheck: **pass**
- tests (with coverage): **pass** (224 tests; gate exit 0)
- mutation (Stryker, local, core touched): **95.62%** overall ≥ 80 threshold;
  new/changed files **100%** (`instrument-detection.ts`, `separate-track.ts`,
  `stem-set.ts`).
- biome / sheriff / knip / jscpd: **pass** (jscpd 8 clones, within threshold —
  pre-existing).

## State to resume from
- **Single next action**: run the `separator-server` with `htdemucs_6s` and
  browser-verify a real separation (guitar/piano appear; near-silent stems are
  masked under « Non détectés »); then start **J2.4** (multitrack mixer).
- Gotchas / half-done edits: none — working tree is this slice only, gate green.
  Note `DISPLAY_ORDER` in `main.py` is keyed by **Demucs source name** (`piano`),
  while `STEM_META` maps it to the UI id (`claviers`).
