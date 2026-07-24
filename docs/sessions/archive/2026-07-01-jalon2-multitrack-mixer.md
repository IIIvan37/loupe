# Session — 2026-07-01 — jalon2-multitrack-mixer

## Done
- **Slice J2.4 — multitrack mixer (solo / mute / volume).** A hexagonal vertical
  slice: pure mixer domain in `@app/core`, a Web Audio gain-graph adapter, the
  mixer UI, and a **unified transport** so the same play/pause/seek/tempo/pitch
  drive the stem mix once stems exist.
- **Pure core (TDD + property + mutation):**
  - `domain/mixer.ts` — `MixerState` (one `MixerChannel` per stem: `gainDb` +
    `muted` + `soloed`), `mixerReducer` (`init`/`setGain`/`toggleMute`/
    `toggleSolo`/`reset`), `effectiveGains` folding the solo/mute rules into one
    linear gain per channel (mute silences itself, any solo silences the
    non-soloed, **mute wins**). dB helpers `clampGainDb` / `dbToAmplitude`
    (`MIN_GAIN_DB −60` … `MAX_GAIN_DB +6`, `UNITY_GAIN_DB 0`); the bottom of the
    fader is **true silence** (exactly 0). Property-tested invariants.
  - `domain/waveform-mix.ts` — `combineWaveforms`: sums stem envelopes weighted
    by their effective gains into one (clamped to [-1, 1]) — the waveform of the
    **audible mix** the main view shows.
  - New port `StemPlaybackEngine` (+ `StemSource`) in `application/ports.ts`:
    multitrack sibling of `PlaybackEngine` (load/play/pause/seek/tempo/pitch/
    position) plus `setGain` per channel. Exports + `application/README.md`
    updated.
- **Web adapters / smart hooks:**
  - `audio/web-audio-stem-playback.ts` — `createWebAudioStemPlayback`: a
    `GainNode` per stem summed into one SoundTouch master bus (tempo/pitch on the
    mix; sources share `playbackRate`/start so they stay in sync). Humble object
    (untested in jsdom).
  - `app/mixer/use-mixer.ts` — owns the `MixerState`; `load(stems, sources)` /
    `reset()` are **event-driven** (called from the separation handler / on
    import), not an effect; control changes push `effectiveGains` into the engine
    from their own handlers; exposes `channels` (with effective `gain` + clamped
    `level`) and the reactive `mixWaveform`.
  - `app/mixer/mixer-panel.tsx` — one control strip per present stem: dB fader
    (amber), mute/solo toggles, teal confidence badge, WAV export.
  - `app/mixer/stem-lanes.tsx` — per-stem **aligned, read-only** waveform lanes
    rendered **inside `ZoomStage`**, so they share the main view's zoom/scroll/
    playhead and pale with each channel's level.
  - `app/stems/stem-color.ts` — shared stem→colour map (`stemColorVar` /
    `stemColor`), reused by the separation panel and the mixer; `WaveformCanvas`
    gained an optional `colorVar` (default amber) to paint stems.
- **Unified transport** (`use-player.ts`): the shell shares one
  `StemPlaybackEngine`; once `stemsActive`, play/pause/seek route to it (tempo/
  pitch applied to both engines so a hand-off stays in sync), the position
  listener subscribes to both, and a hand-off effect settles the active engine at
  the current playhead. The **main waveform shows the reactive audible mix** while
  stems are mixing.
- **UX fix (user feedback):** the « Séparer les pistes » action is hidden once the
  stems are ready (a re-run needs a fresh import); it stays a « Réessayer » on
  failure. The present-stems list moved from `SeparationPanel` to the mixer;
  `SeparationPanel` keeps the action/progress/error and the « Non détectés » line.

## Not done / remaining
- **Browser verification pending** — the stem gain graph + unified transport are
  humble objects (no Web Audio in jsdom). Needs the local FastAPI+Demucs server
  running and a real track: separate → confirm the mix plays in sync, faders/
  solo/mute change what's heard, the lanes pale, and the main waveform reflects
  the audible mix.
- Slice J2.6 (export — aligned stem folder, zipped) is the last Jalon 2 slice.

## Decisions
- **Faders are in dB** (model stores dB, engine converts to linear) — matches the
  plan's "gains dB" read-out.
- **Unified transport**: stems replace the single-track source once ready (one
  playhead/loop for the whole mix), rather than a separate mixer audition.
- **Main waveform = reactive audible mix** (recomputed from `effectiveGains` as
  solo/mute/volume change); stem lanes are aligned and read-only, driven by the
  one shared transport.
- Engine load + mixer seed are triggered from the **event** (separation
  completing / file import), not a prop-watching effect — keeps `useMixer` free of
  the react-doctor "state+effect as event handler" smell and avoids an extra
  render. `separate()` now returns its committed result so the shell can wire the
  mixer in the same handler.

## Gate status
- typecheck: ✅
- tests (with coverage): ✅ 268 passed (38 files)
- mutation (Stryker, local, core): ✅ 95.54% overall (≥ 80 break threshold);
  new files `mixer.ts` 95.52%, `waveform-mix.ts` 94.29%.
- biome / sheriff / knip / jscpd: ✅ — and the extra web gates impeccable +
  react-doctor (react-doctor: "No issues found").

## State to resume from
- **Single next action**: browser-verify J2.4 — run the separator server +
  `pnpm --filter @app/web dev`, import a track, separate, and check the mixer
  (sync playback, faders/solo/mute, paling lanes, reactive main mix). Then start
  Slice J2.6 (export).
- Gotchas / half-done edits: none — working tree is the full slice. Stem peak
  resolution was bumped to 1200 (matches the main view) so the combined mix and
  lanes stay crisp; the stem engine relies on its unity default at load (no gain
  push until a control moves).
