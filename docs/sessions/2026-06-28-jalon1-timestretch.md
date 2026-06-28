# Session — 2026-06-28 — jalon1-timestretch

Slice 3 of Jalon 1: **time-stretch (without pitch) + pitch-shift**. Built
outside-in; core gated + mutation-tested; the Web Audio worklet path is a humble
object **to verify in a browser**. Branch `feat/jalon1-timestretch`, PR #8.

## Engine decision — revised mid-slice

- Started on **Rubber Band + GPL** (the kickoff lock). In-browser verification
  showed its only web wrapper (`rubberband-web`) **crashes on live pitch change**
  (detached WASM `ArrayBuffer`) and is unmaintained.
- **Switched to SoundTouch** (`@soundtouchjs/audio-worklet`, **MPL-2.0**): fixes
  the crash, is maintained, pure-JS (no wasm), and **removes the GPL obligation**
  — the product may ship under any licence. Recorded in `STATUS.md`.

## Done

- **Core (pure hexagon), TDD strict:**
  - `clampPlaybackRate` (`domain/playback-rate.ts`) — tempo ratio in `[0.5, 1.5]`,
    `NaN` → 1. Property-tested.
  - `clampPitchSemitones` (`domain/pitch-shift.ts`) — whole semitones in `[-12, 12]`
    (rounds, clamps, `NaN` → 0). Property-tested.
  - `PlaybackEngine` port gains `setTimeRatio` / `setPitchSemitones`.
- **Web adapters (`packages/web`):**
  - `WebAudioPlayback` routes the source through a **SoundTouch AudioWorklet**
    (`@soundtouchjs/audio-worklet`). Model: tempo = source `playbackRate` (keeps
    the stream real-time, no under-run); the node mirrors that rate
    (`node.playbackRate`) and divides pitch by it automatically, so
    `node.pitchSemitones` is the net shift (no manual formula). Position is
    `AudioContext.currentTime` scaled by the ratio, re-based on each ratio change.
    The worklet is loaded via a **lazy dynamic import** (its class extends
    `AudioWorkletNode`, absent in the test/node path); if it fails to load,
    playback still works (controls go inert).
  - The vendored worklet `public/soundtouch-processor.js` (71 KB, pure JS) is
    excluded from biome + jscpd.
  - `usePlayer` gains clamped `setTimeRatio` / `setPitchSemitones`; the
    `TransportBar` tempo (50–150 %) and pitch (±12) sliders are wired and enabled
    once a track is loaded, with mono-font readouts.

## Not done / remaining — ⚠️ verify in a browser

- **The audio effect is unverified here.** jsdom has no Web Audio / AudioWorklet,
  so `WebAudioPlayback` + the SoundTouch worklet are untested (humble object,
  consistent with the decoder/playback adapters). The production `vite build`
  succeeds and the worklet is emitted as a lazy chunk + copied asset, but **actual
  tempo/pitch behaviour must be confirmed in a real browser** (`pnpm --filter
  @app/web dev`): load a file, play, move tempo → speed changes, pitch unchanged;
  move pitch → key changes, tempo unchanged.
- If the worklet fails to load, the sliders stay enabled but inert (no UI signal).
  Follow-up: surface a "time-stretch unavailable" state.
- SoundTouch quality is slightly below Rubber Band on extreme stretches but fine
  for a transcription player; settings near 1.0 sound cleanest.
- Decoder + playback still create separate `AudioContext`s (from Slice 2).

## Decisions

- **Tempo via `playbackRate`, pitch via the worklet.** A realtime worklet fed by a
  real-time source can't stretch a file without under-running; driving tempo with
  the source's `playbackRate` keeps input/output aligned and uses the worklet only
  for (pitch-preserving) transposition. This is why the worklet's own `setTempo`
  stays at 1.
- **Lazy import for the worklet lib.** A static import dragged the worklet class
  (and, with the earlier Rubber Band attempt, `tone`) into the
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
  worklet asset is vendored at `packages/web/public/soundtouch-processor.js`; if
  `@soundtouchjs/audio-worklet` is upgraded, re-copy it from `node_modules`.
- First in-browser check (Rubber Band) crashed on pitch change → switched engine
  to SoundTouch; **re-verify** the SoundTouch build in a browser before merging.
