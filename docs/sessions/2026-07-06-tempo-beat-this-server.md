# Session — 2026-07-06 — tempo-beat-this-server (Lot B, part 2)

The DSP half of **Lot B** of the tempo-detection upgrade (plan:
[docs/tempo-detection-plan.md](../tempo-detection-plan.md)). Part 1 (PR #67,
merged) carried the enriched `/tempo` contract through core + adapter + web +
persistence while the server still ran librosa (bare seconds, tolerated by the
adapter). This part swaps the server DSP to **`beat_this`**, so the server now
emits real downbeats and the whole `barPosition` machinery detects the actual
metre instead of counting 4/4 from beat 0. **Closes Lot B.** On branch
`feat/tempo-beat-this-server` (off `main`).

## Done
- **New torch-free humble object** [server/app/beat_positions.py](../../server/app/beat_positions.py):
  the decidable part of tempo detection, kept out of the ML shell.
  - `to_positioned_beats(beats, downbeats)` maps beat_this's **two separate
    arrays** (beat instants, downbeat instants) to the enriched contract
    `[{time, position}]`: mark each beat that coincides with a downbeat
    (nearest-match within a 50 ms tolerance), number the beats within each bar
    (reset to 1 at each downbeat), and **back-count a leading pickup** from the
    first downbeat (`…, m-1, m, [downbeat=1]`; ascending fallback when the measure
    length is unknown — a single downbeat).
  - `representative_bpm(beats)` = 60 / **median** inter-beat interval (outlier
    gaps like a dropped beat don't skew the read-out; 0 when < 2 beats).
  - `tempo_payload(...)` bundles both into the JSON body.
  - Unit-tested ([test_beat_positions.py](../../server/tests/test_beat_positions.py),
    12 cases incl. 4/4, 3/4, pickup back-count, tolerance match, single-downbeat
    and no-downbeat fallbacks) — **100 % coverage**, pyright-clean.
- **`tempo.py` becomes the thin torch shell**
  ([server/app/tempo.py](../../server/app/tempo.py)): decode WAV → `Audio2Beats`
  → hand the two arrays to the pure mapper. The model is built **once, lazily** on
  the first request (weights fetched to `~/.cache/torch/hub`, like Demucs), guarded
  by a lock; **best device auto-picked** (CUDA → MPS → CPU, same order as
  separation), overridable via `LOUPE_TEMPO_DEVICE` / checkpoint via
  `LOUPE_TEMPO_CHECKPOINT` (`final0` ~78 MB default, `small0` ~8 MB).
- **Same lazy-import 503 fallback**: `main` still `try: from .tempo import router`
  — a host without torch/beat_this serves the rest and `/tempo` answers 503. Only
  the comments changed (librosa → torch/beat_this).
- **requirements**: `+beat-this==1.1.0` (`+rotary-embedding-torch==0.9.1`),
  **`-librosa`** (its only user was `tempo._analyse`).

## Not done / remaining
- **Lot C** — tempo-map (variable tempo): `TempoMap` from beat intervals +
  segmentation, `ProjectTempo.segments` (soft migration), BPM read-out at the
  playhead + a plage. The beats already carry per-beat instants, so the data is
  there; Lot C is core + persistence + web read-out.
- Optional Lot B web nicety (still open from pt.1): a **manual metre override**
  (metre is detection-only today).
- `torchcodec`/`ffmpeg` absent on this Mac's venv, so the source-MP3 → WAV decode
  path couldn't be exercised directly; verification summed the stored stem WAVs
  into the mix instead (see below). Not a product path (the web decodes in the
  browser and POSTs a WAV), so no action.

## Decisions
- **The `(beats, downbeats)` → `[{time, position}]` mapping lives in a torch-free
  module**, per the server's humble-object convention — unit-tested + pyright-checked,
  while the `Audio2Beats` call stays in the excluded shell. Mirrors
  `stem_manifest` / `download.progress_fraction`.
- **Representative BPM = median inter-beat interval**, computed server-side in the
  pure module (was librosa's scalar estimate before). The core's `DetectedTempo.bpm`
  is documented as "representative (median)", so this matches.
- **A leading pickup back-counts from the first downbeat** rather than numbering
  ascending from 1 — keeps the felt bar phase and stops a short anacrusis from
  inflating `detectMeter` (max position). Verified on Lullaby: the t=0 beat reads
  position 4, the 0.64 s downbeat reads 1.
- **Dropped librosa** entirely (not kept as a runtime fallback) — the "503
  fallback" the plan named is the lazy-import guard, not a second DSP. One engine,
  less surface.
- **Ship as Lot B pt.2** (its own PR), per the user-confirmed 2-PR split: pt.1 was
  fully testable without the heavy install; pt.2 needed the ML weights + real audio
  on the Mac.

## Gate status
- typecheck: ✅ (JS gate green — diff is server-only)
- tests (with coverage): ✅ **624 passed / 71 files** (web 95.61 % / 88.58 %,
  unchanged — no JS touched). **Server pytest: 91 passed, 97 % total**
  (`beat_positions.py` **100 %**), run in the torch-*ful* venv; the torch-free path
  (503 fallback) stays covered by `test_main_fallbacks`.
- server lint/types: ✅ ruff clean, ruff format clean, **pyright 0 errors**.
- mutation (Stryker): **skipped** — this step touched no `@app/core` package
  (server-only Python; Stryker's scope is the JS core).
- biome / sheriff / knip / jscpd: ✅ (jscpd 5 clones, all pre-existing).
- **Real-audio verified on the Mac (MPS)**: The Cure – Lullaby (4:19), mix
  reconstructed by summing the 5 stored stem WAVs → **93.75 BPM** (the track's
  known tempo), **metre 4/4**, 97 downbeats, inter-downbeat gaps **all exactly 4
  beats**. Pipeline decode WAV → beat_this → pure mapping → enriched contract, ~5 s.

## State to resume from
- **Single next action**: push `feat/tempo-beat-this-server`, open its PR (Lot B
  pt.2), merge. Then **Lot C** (tempo-map) is the last piece of the plan.
- Gotchas / half-done edits: none — branch clean, both gates green, real-audio
  verified. The web adapter already speaks the enriched shape (shipped in pt.1), so
  the server swap is drop-in; nothing else moves.
