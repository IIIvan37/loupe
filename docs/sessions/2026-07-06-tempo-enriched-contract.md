# Session — 2026-07-06 — tempo-enriched-contract (Lot B, part 1)

Linchpin of the tempo-detection upgrade (plan:
[docs/tempo-detection-plan.md](../tempo-detection-plan.md)). The pure, testable
half of **Lot B** — the enriched `/tempo` contract carried end-to-end through
core + adapter + web + persistence — shipped ahead of the server `beat_this` DSP
swap (deliberately deferred: a heavy install + weights download, only verifiable
with real audio on the Mac). Scope confirmed with the user up front.

## Done
- **Core port (`DetectedTempo`)** enriched: beats now carry a **`barPosition`**
  (1 = downbeat), not bare seconds. New domain type `DetectedBeat { timeSeconds,
  barPosition }` ([tempo.ts](../../packages/core/src/domain/tempo.ts)); the port
  imports it (application → domain).
- **`buildBeatGrid` rewritten** to flag downbeats from `barPosition === 1` —
  robust to a pickup bar or a missing beat, no more counting from beat 0. New pure
  **`detectMeter(beats)`** = largest bar position seen (default 4 when empty).
- **`foldTempoOctave` adapted** to the new representation: it now folds the grid
  directly and **carries downbeat flags from the retained beats** (inserted
  midpoints are never downbeats), so a fold keeps the felt bar phase anchored to
  the same instants instead of re-counting from beat 0. Dropped the now-unused
  `beatsPerBar` parameter.
- **`detectTempo` use-case** derives grid + meter from the positions;
  `TempoAnalysis` gains **`beatsPerBar`**. `DetectTempoInput.beatsPerBar` removed
  (the meter is detected, not supplied).
- **Persistence**: `ProjectTempo.beatsPerBar?` (core) — absent ⇔ common time on
  manifests predating the enriched contract. Threaded through `liveTempo` (save)
  and the restore path (`persisted.beatsPerBar ?? DEFAULT_BEATS_PER_BAR`). **Not**
  added to `sessionSignature` — the meter is derived from detection, not
  user-editable (same rule that keeps bpm/grid out; only the fold `octaveShift`
  is signed).
- **Web adapter** [http-tempo-detector.ts](../../packages/web/src/audio/http-tempo-detector.ts):
  maps `{ bpm, beats: [{ time, position }] }` → `DetectedBeat[]`, and **tolerates
  the current librosa server** (bare seconds → positions counted in common time)
  so the app keeps working until the `beat_this` server ships.
- **Web display**: a **meter read-out** (« N temps ») beside the BPM in
  [tempo-panel.tsx](../../packages/web/src/app/tempo/tempo-panel.tsx); `beatsPerBar`
  threaded through the hook → shell → panel. New Lingui id `tempo.meter`
  (catalog extracted).
- `foldTempoOctave` in the hook carries `beatsPerBar` through unchanged (a fold is
  an octave correction, not a re-reading of the meter).
- Tests updated/added: domain (buildBeatGrid follows detected downbeats,
  detectMeter incl. 3/4, fold preserves phase both ways), use-case (grid + meter
  derivation), adapter (positioned + legacy-tolerant), panel (meter shown), hook,
  restore round-trip (default + persisted meter). Fakes across the shell/session
  specs migrated from `beatsSeconds` to positioned `beats`.

## Not done / remaining
- **Lot B — server half (next PR)**: swap `_analyse` in
  [server/app/tempo.py](../../server/app/tempo.py) to **`beat_this`** (keep the
  librosa 503 fallback), map `(beats, downbeats)` → `[{time, position}]`
  (`position = 1` if in downbeats, else index-since-last-downbeat + 1), and add
  server tests for that **pure mapping** (humble-object convention — the
  `Audio2Beats` call itself stays uncovered). `pip install beat-this` (~78 MB
  `final0` weights, or 8 MB `small0`); torch≥2 already present for Demucs.
- **Lot C** — tempo-map (variable tempo): `TempoMap` from beat intervals +
  segmentation, `ProjectTempo.segments`, BPM read-out at the playhead.
- Optional Lot B web nicety: a **manual meter override** (currently meter is
  detection-only).

## Decisions
- **Ship Lot B in two PRs** (user-confirmed): the pure contract/core/web now, the
  `beat_this` DSP swap next. The contract is the linchpin and is fully testable
  without the heavy install; the server swap needs real audio + the Mac.
- **`barPosition` lives in the domain** (`DetectedBeat`), not the port, so the
  domain `buildBeatGrid`/`detectMeter` can consume it without violating the
  `application → domain` direction; the port re-uses it.
- **Fold preserves downbeat phase** rather than re-anchoring from beat 0 (the Lot A
  « naive » behaviour the plan flagged for adaptation). Strictly better musically;
  the two Lot A fold tests that encoded the old behaviour were rewritten.
- **Meter stays out of `sessionSignature`** — derived, not user-editable.
- **Adapter tolerates the legacy shape** so the branch is shippable/mergeable
  before the server PR lands (no lockstep deploy).

## Gate status
- typecheck: ✅
- tests (with coverage): ✅ **624 passed / 71 files**; web 95.61 % / 88.58 %.
- mutation (Stryker, local, core touched): ✅ overall **94.92 %** ≥ 80; new/changed
  core files **100 %** — `tempo.ts` (38 mutants), `detect-tempo.ts` (8),
  `project.ts` (30).
- biome / sheriff / knip / jscpd: ✅ (design + react-doctor green; jscpd 5 clones,
  all pre-existing).

## State to resume from
- **Single next action**: open the PR for `feat/tempo-enriched-contract`, then
  start the **Lot B server half** — swap `server/app/tempo.py` `_analyse` to
  `beat_this` behind the librosa 503 fallback, with a torch-free pure test for the
  `(beats, downbeats) → [{time, position}]` mapping.
- Gotchas / half-done edits: none — branch clean, gate + mutation green. The web
  adapter already speaks the enriched shape and tolerates the current librosa
  server, so nothing breaks in the window before the server PR ships.
