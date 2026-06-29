# STATUS

> Resumable source of truth. Updated at the end of each step via `/session-report`.

## Where we are

- **Phase**: **Jalon 2 (« Séparation IA ») — Slice J2.2 done (PR pending).** Plan in
  [docs/jalon-2-plan.md](jalon-2-plan.md). J2.1 merged via **PR #16**. Jalon 1
  (« Transcribe! dans le navigateur ») is **complete + polished**: all 7 slices
  merged (Slice 7 via **PR #13** `ab6e1ad`), loops/markers/transport refinement
  merged via **PR #14** (`65297a2`). See [docs/jalon-1-plan.md](jalon-1-plan.md).
- **Branch**: `feat/jalon2-wasm-separator` (Slice J2.2). Next: open the PR, then
  Slice J2.3 (adaptive detection) — or a follow-up speed slice (multi-worker
  parallel GGML).
- **Packages**: `@app/core` (pure hexagon — `loadTrack`, `Waveform`/`Track`,
  `transportReducer`/`formatTimecode`, `clampPlaybackRate`/`clampPitchSemitones`,
  `clampZoom`/`zoomIn`/`zoomOut`, `resolveCommand`/`defaultKeyBindings`,
  `TrackMetadataReader` port, `separateTrack`/`StemSeparator` port +
  `separationReducer`/`StemSet`, `planSegments`/`transitionWindow` overlap-add DSP)
  + `packages/web` (import → waveform → transport → time-stretch/pitch → markers →
  loops → zoom → keyboard shortcuts → real WASM stem separation: `createSeparator`
  → GGML `demucs.cpp` default or `onnxruntime-web`, in module workers, gate-green).
  The starter `@app/cli`/`greet` example has been removed.

## Locked decisions (kickoff)

- **Time-stretch engine**: **SoundTouch** (`@soundtouchjs/audio-worklet`, MPL-2.0)
  — **REVISED (2026-06-28)**. Rubber Band was confirmed at Slice 3 start, but its
  only web wrapper (`rubberband-web`) crashes on live pitch change and is
  unmaintained; in-browser verification surfaced it. SoundTouch fixes the crash
  **and** lifts the GPL obligation — the product can ship under any licence.
- **Separation engine** (J2.2): **demucs.cpp compiled to WASM (GGML, fp16)** is the
  default adapter — single-thread SIMD, no COOP/COEP, memory-safe; **onnxruntime-web**
  kept as a selectable alternative. WebGPU ruled out (htdemucs embedded iSTFT
  unsupported on the GPU EP). htdemucs weights are research-only — fine for this
  non-commercial tool, not for a commercial product.
- **Web stack**: React + Jotai · Base UI (headless) · Every Layout · CSS Modules +
  CSS-variable tokens · smart/dumb components.
- **Extra gates** (blocking, `packages/web` only): impeccable + react-doctor.
- **Per-slice loop**: `/new-feature-hexa` → `/tdd-cycle` → `pnpm gate` →
  `pnpm test:mutation` → **`/code-review`** → `/session-report` → PR.

## Next step

**Slice J2.2 done (PR pending).** Two real client-side separators behind the
`StemSeparator` port, selectable via `createSeparator('ggml' | 'onnx')`: default
**GGML** (`demucs.cpp` compiled to WASM, fp16, single-thread SIMD, engine committed
under `public/demucs/`) and **ONNX** (htdemucs via `onnxruntime-web`). Pure core
`segment-plan` (overlap-add DSP) added. Browser-verified. Known limit: CPU
single-thread is heavy — neither engine is faster than the other; the speed lever
(multi-worker data parallelism) is deferred. Next: open the PR, then **Slice J2.3**
(adaptive instrument detection). See [docs/jalon-2-plan.md](jalon-2-plan.md).

## Roadmap

| Step | Description | Status |
|------|-------------|--------|
| 0 | Starter bootstrapped (monorepo, toolchain, guardrails, example slice) | ✅ |
| J1.0 | Scaffold `packages/web` (Vite+React+TS, tokens, Every Layout, Base UI, extended gate) | ✅ |
| J1.1 | Import local file → waveform | ✅ |
| J1.2 | Transport: play/pause/seek + playhead + Space | ✅ |
| J1.3 | Time-stretch + pitch (SoundTouch worklet) — browser-verified | ✅ |
| J1.4 | Markers (section/measure/beat) | ✅ |
| J1.5 | A/B loop drag-select + named loops (the « loupe ») | ✅ |
| J1.6 | Zoom + scrollable viewport (6×) | ✅ |
| J1.7 | Keyboard shortcuts | ✅ |
| J2.1 | Import → separation → tracks screen (stub separator behind `StemSeparator` port) | ✅ |
| J2.2 | Real WASM separator adapters (demucs.cpp GGML default + onnxruntime-web), off-main-thread | ✅ |
| J2.3 | Instrument detection → N adaptive tracks (mask empty, confidence) | ⬜ |
| J2.4 | Multitrack mixer (solo/mute/volume, Web Audio gain graph) | ⬜ |
| J2.5 | Track grouping (user bus, non-destructive) | ⬜ |
| J2.6 | Export — tier A: aligned stem folder (+ bounced groups) | ⬜ |

## Session journal

Dated reports under [docs/sessions/](sessions/). Most recent on top.

- [2026-06-29 — jalon2-wasm-separator](sessions/2026-06-29-jalon2-wasm-separator.md) —
  Slice J2.2: real client-side separation behind the `StemSeparator` port. Core
  `segment-plan` (planSegments + transitionWindow, overlap-add DSP, mutation 95.95%).
  Two selectable WASM engines (`createSeparator`): default **GGML** (`demucs.cpp`
  compiled via Docker/emsdk, fp16 ~84 MB, committed under `public/demucs/`) and
  **ONNX** (htdemucs via onnxruntime-web, ~166 MB). Module workers, resample to
  44.1 kHz, Cache-API model download. Browser-verified. WebGPU ruled out (ORT can't
  run the embedded iSTFT on GPU); fp16-vs-OOM and several Vite /public-import gotchas
  documented. Speed limit (CPU single-thread) → multi-worker parallelism deferred.
  Gate green, core mutation 95.98%.
- [2026-06-28 — jalon2-separation-screen](sessions/2026-06-28-jalon2-separation-screen.md) —
  Slice J2.1 (opens Jalon 2): separate the loaded track into stems, UI-first behind
  a pure `StemSeparator` port. Core: `separateTrack` use-case + `SeparationState`
  reducer + `StemSet`/`StemTrack` (`buildStemTrack` reuses the track mono-mix →
  waveform). `loadTrack` now returns the decoded PCM so separation reuses the SAME
  input (no second import). Web: `createStubSeparator`, `useSeparation` (run-id
  guard against a stale run), `SeparationPanel`. Gate green; core mutation 95.99%
  (`separate-track`/`stem-set` 100%). High-effort review: 1 real bug fixed (stale
  separation landing on a new track).
- [2026-06-28 — jalon1-polish-loops-markers](sessions/2026-06-28-jalon1-polish-loops-markers.md) —
  Hands-on polish of Jalon 1: wired transport ⏮/⏭ (⟳ removed); live loop
  selection + draggable A/B handles that update saved loops in place; `NameEditor`
  popover replacing `window.prompt` (loops + marker rename); loop enable/disable
  toggle; no duplicate-save for saved regions; markers simplified to one named
  « Repère » (dropped `MarkerKind` from core); zoom scrollbar gutter reserved to
  stop layout shift. Gate green, core mutation 96.25% (key-bindings & marker-list
  100%).
- [2026-06-28 — jalon1-shortcuts-help-and-layout-fix](sessions/2026-06-28-jalon1-shortcuts-help-and-layout-fix.md) —
  Slice 7 follow-up (same branch / PR #13): in-app shortcuts help (pure
  `describeKeyBindings` deriving French rows from the active bindings + Base UI
  `ShortcutsDialog` behind a header "?"). Two in-browser fixes: shortcuts were
  swallowed while a control button held focus (guard now blocks only text entry),
  and layout-wrong keys (`+`/`−` dead, `,` instead of `m`) — `KeyChord` now matches
  mnemonic keys by typed character, spatial keys by physical code. `key-bindings.ts`
  100% mutation. Gate green.
- [2026-06-28 — jalon1-keyboard-shortcuts](sessions/2026-06-28-jalon1-keyboard-shortcuts.md) —
  Slice 7 (closes Jalon 1): pure `KeyBindings` domain (`resolveCommand` /
  `defaultKeyBindings`, exact code+modifier match, 100% mutation) +
  `useKeyboardShortcuts` web adapter folding in the old Space listener (ref-fresh
  actions, `enabled`-gated). Space/←→/=−/M bound; bare keys never hijack browser
  chords. Gate green.
- [2026-06-28 — jalon1-zoom-review](sessions/2026-06-28-jalon1-zoom-review.md) —
  Slice 6 follow-up: prototype-aligned zoom (magnify slider + native scroll +
  shared `ZoomStage`), `Viewport` reduced to a zoom scalar, file-metadata header
  (`TrackMetadataReader` + music-metadata), inspector marker list, high-effort
  code review fixed (metadata race, marker removal, auto-follow). Merged via
  PR #11 (first cut) + PR #12 (corrections).
- [2026-06-28 — jalon1-zoom-viewport](sessions/2026-06-28-jalon1-zoom-viewport.md) —
  Slice 6: pure `Viewport` (normalised ratio space, round-trip property-tested,
  mutation 95.35%) + `sliceWaveform`, `useViewport` + `ViewportControls`,
  viewport-aware `WaveformView` (slice peaks, zoom-at-centre, wheel pan, memoised
  canvas). 4 code-review fixes folded in (empty-slice bug, wheel intent, anchor,
  memo).
- [2026-06-28 — session-wrap](sessions/2026-06-28-session-wrap.md) — Jalon 1
  Slices 1→5 shipped & merged (PRs #6–#10); engine switched to SoundTouch (MPL);
  tooling findings (gate enforcement is CI+manual not pre-commit; impeccable scope).
- [2026-06-28 — jalon1-loops](sessions/2026-06-28-jalon1-loops.md) —
  Slice 5: `LoopRegion`/`LoopLibrary` + `LoopStore` port + loops use-cases (core,
  loops.ts 100% mutation), localStorage adapter, drag-select + loupe dim overlay +
  loop playback + saved-loops bar.
- [2026-06-28 — jalon1-markers](sessions/2026-06-28-jalon1-markers.md) —
  Slice 4: `Marker`/`MarkerList` (core, marker-list 100% mutation), `useMarkers`,
  `MarkerControls` + `MarkerRail` (add at playhead, click-seek, remove, amber by kind).
- [2026-06-28 — jalon1-timestretch](sessions/2026-06-28-jalon1-timestretch.md) —
  Slice 3: `clampPlaybackRate`/`clampPitchSemitones` (core, mutation 94.41%),
  `PlaybackEngine` gains tempo/pitch, Rubber Band worklet adapter + wired sliders.
  GPL confirmed. ⚠️ audio path browser-verify pending.
- [2026-06-28 — jalon1-transport](sessions/2026-06-28-jalon1-transport.md) —
  Slice 2: `transportReducer` + `formatTimecode` (core, mutation 96%), `PlaybackEngine`
  port + `WebAudioPlayback` adapter, play/pause/seek, playhead, click-to-seek, Space.
- [2026-06-28 — jalon1-import-waveform](sessions/2026-06-28-jalon1-import-waveform.md) —
  Slice 1: `loadTrack` + `Waveform`/`Track` (core, mutation 96.70%), `WebAudioDecoder`
  adapter, single header-driven import, amber `WaveformCanvas`. Gate green.
- [2026-06-28 — jalon1-web-scaffold](sessions/2026-06-28-jalon1-web-scaffold.md) —
  Slice 0: `packages/web` scaffolded (Vite+React+Base UI+Every Layout+CSS Modules),
  gate extended (impeccable + react-doctor), kickoff decisions locked.
