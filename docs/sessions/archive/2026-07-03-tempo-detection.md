# Session — 2026-07-03 — tempo-detection

## Done
- **Real tempo detection (UX-backlog)** — a full hexagonal vertical slice,
  server-side per the locked decision (`librosa`, mirroring the separation
  precedent: browser DSP was out of scope for quality).
  - **Core (TDD, outside-in)**: new driven port `TempoDetector`
    (`detect(audio) => { bpm, beatsSeconds }`), the `detectTempo` use-case
    (SAME `DecodedAudio` the player loaded → `Result`), and a pure beat-grid
    domain `buildBeatGrid(beatsSeconds, beatsPerBar)` → `BeatGrid` (every
    `beatsPerBar`-th beat flagged a downbeat, meter assumed constant,
    `DEFAULT_BEATS_PER_BAR = 4`). Exported (`TempoDetector`, `DetectedTempo`,
    `detectTempo`, `TempoAnalysis`, `BeatGrid`); registered in
    `application/README.md`.
  - **Web adapter**: `createHttpTempoDetector` (mix → WAV `POST /tempo` → JSON
    `{ bpm, beats }`, mapped to `DetectedTempo`; body validated) + the
    `createTempoDetector` factory (`SERVER_URL`). `useTempo` smart hook: run-id
    guard drops a superseded detection, `reset()` on a fresh track.
  - **UI**: `TempoPanel` (a « Détecter le tempo » action → « NNN BPM » read-out
    → « Recalculer », busy + error states) below the timeline; a **beat-grid
    overlay** on the waveform (`WaveformView` `beatGrid` prop → absolutely
    positioned lines, downbeats stronger, `data-beat` for tests). Wired through
    ShellMain/ShellStage; `startFreshTrack` resets the analysis. The old stub
    « no detected chips » test reworded to the real behaviour.
  - **Server**: new `app/tempo.py` — `POST /tempo` runs librosa's beat tracker
    off the event loop (`run_in_threadpool`). Lazy/optional like separation: a
    host without librosa still serves everything else and `/tempo` answers 503.
    `librosa>=0.10` added to `requirements.txt`; README + `main.py` docstring
    updated.
- **Server DSP validated locally** (librosa installed into the venv): synthetic
  click tracks at 44.1 kHz return 120.2 / 100 / 89 BPM against 120 / 100 / 90
  targets, 23 beats at ~0.5 s spacing; malformed upload → 400. Found & fixed a
  real bug: `beat_track(y=…)` uses **median** onset aggregation which flattens
  sharp transients at 44.1 kHz and collapsed the estimate to 0 BPM — compute the
  onset envelope explicitly (mean) and pass it. torch/demucs still import after
  the numpy 2.5→2.4 pin librosa pulled in (separation stack intact).
- **Review pass (high-effort)** fixed three items: JSON body validation in the
  adapter (a malformed 200 gave a cryptic `TypeError`), the event-loop block
  above, and dropped the unused `Beat` public export (knip blind spot;
  `BeatGrid` is the only named consumer).

## Not done / remaining
- **Browser-verify on the Mac** with the server up (`pnpm dev`): import a real
  track → « Détecter le tempo » → BPM read-out + beat grid aligned to the audio;
  re-import clears it. Needs `pip install -r requirements.txt` (librosa) in the
  server venv on the Mac.
- **Metronome stem** — user-requested follow-up (next slice): synthesize a click
  aligned to the detected beats (accented downbeats) as a playable/mixable stem.
  Builds directly on `BeatGrid`.
- **Tempo persistence** — conscious slice boundary: the analysis is
  detect-on-demand, reset on track change, NOT saved. Reopening a project shows
  no grid until re-detected (and needs the server up). Natural next step: a
  `ProjectTempo` field beside `ProjectTuning` — likely folded into the metronome
  slice.

## Decisions
- **Server-side detection (librosa) behind the `TempoDetector` port** — the user
  chose the server path over pure-TS for proven quality; the port keeps a
  pure-TS worker or a cloud API open as later adapters (same shape as
  `StemSeparator`).
- **Beat grid is a read-only visual layer, not user markers** — honours the
  `Marker` domain's note that "bars and beats are not user markers"; `BeatGrid`
  is a distinct type, never mixed into `MarkerList`.
- **Explicit mean onset envelope** on the server — the fix for the 44.1 kHz
  0-BPM collapse; do not revert to `beat_track(y=…)` (median aggregation).

## Gate status
- typecheck / biome / sheriff / impeccable / react-doctor / knip / jscpd: ✅
  (`pnpm gate` exit 0, also at pre-commit)
- tests (with coverage): ✅ **463 passed** (was 438; +25)
- mutation (Stryker, local): ✅ **95.75 %** overall; `tempo.ts` **100 %**,
  `detect-tempo.ts` 100 % after adding the default-meter test that killed the
  surviving `?? → &&` mutant.

## State to resume from
- **Single next action**: open the PR for `feat/tempo-detection` (report
  included), then build the **metronome stem** slice (user request), then
  browser-verify both on the Mac.
- Gotchas: `librosa` was installed into `separator-server/.venv` on this machine
  and pinned numpy to 2.4.6 (torch/demucs re-verified OK). The Mac venv needs
  `pip install -r requirements.txt` before `/tempo` works. react-doctor's
  `async-defer-await` rule fires on `await` before an early-return guard — use
  the positive `if (runId === current) { commit }` form (as `useSeparation` and
  now `useTempo` do), not `if (!==) return`.
