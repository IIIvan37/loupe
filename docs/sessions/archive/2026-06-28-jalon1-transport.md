# Session — 2026-06-28 — jalon1-transport

Slice 2 of Jalon 1: **transport — play/pause/seek + playhead + Space**. Built
outside-in, gated, mutation-tested and code-reviewed. Branch
`feat/jalon1-transport`, PR opened.

## Done

- **Core (pure hexagon), TDD strict:**
  - `transportReducer` / `initialTransport` (`domain/transport.ts`) — a
    `TransportState` machine (position / duration / isPlaying) over a bounded
    timeline: `load` / `play` / `pause` / `toggle` / `seek` / `tick`, all clamped
    to `[0, duration]`; reaching the end stops playback. Unit + fast-check
    invariant (position always inside the timeline).
  - `formatTimecode` (`domain/timecode.ts`) — `m:ss`, floors fractions, clamps
    negatives/NaN, counts minutes past an hour. Replaces the placeholder seconds
    readout from Slice 1.
  - New driven port `PlaybackEngine` (`load/play/pause/seekTo/onPositionChange`).
  - `loadTrack` extended: decodes **once**, builds the waveform **and** loads the
    same PCM into the engine (deps now `{ decoder, engine }`).
- **Web adapters (`packages/web`):**
  - `WebAudioPlayback` (`audio/web-audio-playback.ts`) — `PlaybackEngine` via an
    `AudioBufferSourceNode`; position derived from `AudioContext.currentTime` and
    streamed each animation frame; one-shot source recreated on play/seek.
  - `usePlayer` hook (replaces `useTrackImport`) — owns import + transport state,
    subscribes to engine position → `tick`, steers the engine; pauses the engine
    on unmount.
  - Shell: play/pause wired to `TransportBar`, global **Space** shortcut
    (latest-ref, ignores interactive targets), `m:ss` readout, playhead overlay +
    **click-to-seek** on the waveform.
- **Code-review fixes applied:** guard click-to-seek against a zero-width surface
  (was a NaN→position hazard); latest-ref assignment moved into an effect; engine
  paused in the hook cleanup to stop the rAF loop + audio on unmount.

## Not done / remaining

- `WebAudioPlayback` decodes via its own `AudioContext` while `WebAudioDecoder`
  creates another — two contexts per session. Follow-up: share one context.
- `play()` fires `resume()` without awaiting (fine for click-initiated playback;
  revisit if first-play-after-suspend ever misbehaves).
- `PlaybackEngine` has no `dispose()`; the hook mitigates by pausing on unmount.
  Add an explicit dispose if the app ever runs multiple players/routes.
- `WebAudioPlayback` is untested (jsdom has no Web Audio) — humble object, verified
  in a real browser; outside the gated core coverage.

## Decisions

- **One decode per import.** `loadTrack` now loads the engine too, so a file is
  decoded a single time for both waveform and playback (avoids a double-decode).
- **Transport is a pure reducer, not a use-case.** The continuous play/seek
  interaction is driven by the smart hook over the `PlaybackEngine` port; the core
  stays timer-free. Registered as such in `application/README.md`.
- **Position is engine-sourced.** The reducer never advances time on its own; it
  only reacts to `tick` events the engine emits — single source of truth.

## Gate status

- typecheck: ✅
- tests (with coverage): ✅ 59 passing; core meets its 90% threshold.
- mutation (Stryker, local, core touched): ✅ **96.00%** (break 80). Remaining
  survivors are equivalent mutants (boundary `<`/`<=`/`>`/`>=` where both branches
  yield the same clamped value; `new Array()` preallocation size).
- biome / sheriff / knip / jscpd: ✅ (the one jscpd CSS clone is the pre-existing
  Slice 0 header/transport-bar pair, below threshold, non-blocking).
- extended gates (`packages/web`): impeccable ✅ · react-doctor ✅.

## State to resume from

- **Single next action**: start **Slice 3** — time-stretch (without pitch) +
  pitch-shift. ⚠️ **Licence gate first**: Rubber Band ⇒ the product must ship GPL
  or under a commercial licence — reconfirm before writing the worklet. Then spike
  an isolated `AudioWorkletProcessor`, extend `PlaybackEngine` with
  `setTimeRatio` / `setPitchSemitones`, and add pure `PlaybackRate` / `PitchShift`
  domain (clamped ranges) outside-in.
- Gotchas / half-done edits: none — tree committed on the feature branch. IDE
  SonarLint flags (`window`→`globalThis`, array→`Set`, `as number` casts) are
  IDE-only; Biome + the gate's `tsc` accept the code — leave them.
