# Session — 2026-06-28 — jalon1-timestretch

Slice 3 of Jalon 1: **time-stretch (without pitch) + pitch-shift** via Rubber
Band. Built outside-in; core gated + mutation-tested; the Web Audio worklet path
is a humble object **to verify in a browser**. Branch `feat/jalon1-timestretch`,
PR opened.

## Decision confirmed

- **Rubber Band + GPL.** The product ships under **GPL** (open-source). This
  unlocks Rubber Band as the time-stretch/pitch engine. Recorded in `STATUS.md`
  (locked decisions).

## Done

- **Core (pure hexagon), TDD strict:**
  - `clampPlaybackRate` (`domain/playback-rate.ts`) — tempo ratio in `[0.5, 1.5]`,
    `NaN` → 1. Property-tested.
  - `clampPitchSemitones` (`domain/pitch-shift.ts`) — whole semitones in `[-12, 12]`
    (rounds, clamps, `NaN` → 0). Property-tested.
  - `PlaybackEngine` port gains `setTimeRatio` / `setPitchSemitones`.
- **Web adapters (`packages/web`):**
  - `WebAudioPlayback` now routes the source through a **Rubber Band AudioWorklet**
    (`rubberband-web`, GPL-2.0). Model: tempo = source `playbackRate` (keeps the
    stream real-time, no worklet under-run); the worklet's `setPitch` cancels the
    `playbackRate` transposition and applies the wanted shift —
    `pitch = 2^(semitones/12) / ratio`. Position is `AudioContext.currentTime`
    scaled by the ratio, re-based on each ratio change. The worklet is loaded via a
    **lazy dynamic import** (keeps its wasm/`tone` bundle out of the test/node
    path); if it fails to load, playback still works (controls go inert).
  - The vendored worklet `public/rubberband-processor.js` (598 KB, wasm embedded)
    is excluded from biome + jscpd.
  - `usePlayer` gains clamped `setTimeRatio` / `setPitchSemitones`; the
    `TransportBar` tempo (50–150 %) and pitch (±12) sliders are wired and enabled
    once a track is loaded, with mono-font readouts.

## Not done / remaining — ⚠️ verify in a browser

- **The audio effect is unverified here.** jsdom has no Web Audio / AudioWorklet,
  so `WebAudioPlayback` + the Rubber Band worklet are untested (humble object,
  consistent with the decoder/playback adapters). The production `vite build`
  succeeds and the worklet is emitted as a lazy chunk + copied asset, but **actual
  tempo/pitch behaviour must be confirmed in a real browser** (`pnpm --filter
  @app/web dev`): load a file, play, move tempo → speed changes, pitch unchanged;
  move pitch → key changes, tempo unchanged.
- If the worklet fails to load, the sliders stay enabled but inert (no UI signal).
  Follow-up: surface a "time-stretch unavailable" state.
- `rubberband-web` pulls `tone` as an optional dep; the lazy chunk pulled it in
  cleanly at build, but watch bundle size — consider the raw `rubberband-wasm`
  later to drop `tone`.
- Decoder + playback still create separate `AudioContext`s (from Slice 2).

## Decisions

- **Tempo via `playbackRate`, pitch via the worklet.** A realtime worklet fed by a
  real-time source can't stretch a file without under-running; driving tempo with
  the source's `playbackRate` keeps input/output aligned and uses the worklet only
  for (pitch-preserving) transposition. This is why the worklet's own `setTempo`
  stays at 1.
- **Lazy import for the worklet lib.** A static import dragged `tone` into the
  vitest/node module graph and broke the suite; `import type` + dynamic `import()`
  confines it to the browser path.

## Gate status

- typecheck: ✅
- tests (with coverage): ✅ 71 passing; core meets its 90% threshold.
- mutation (Stryker, local, core touched): ✅ **94.41%** (break 80). Remaining
  survivors are equivalent boundary mutants in the clamps (`<`/`<=`, `>`/`>=`
  where both branches return the same limit value).
- biome / sheriff / knip / jscpd: ✅ (`public/` excluded from biome + jscpd).
- extended gates (`packages/web`): impeccable ✅ · react-doctor ✅.
- `pnpm --filter @app/web build`: ✅ (worklet emitted as a lazy chunk).

## State to resume from

- **Single next action**: **verify Slice 3 in a browser** (tempo without pitch,
  pitch without tempo). If correct, the slice is complete; if not, iterate on
  `WebAudioPlayback` (the model/formula is documented inline). Then start **Slice
  4** — markers (section / measure / beat): pure `Marker` / `MarkerList` domain +
  a timeline ruler in the UI.
- Gotchas / half-done edits: none — tree committed on the feature branch. The
  worklet asset is vendored at `packages/web/public/rubberband-processor.js`; if
  `rubberband-web` is upgraded, re-copy it from `node_modules`.
