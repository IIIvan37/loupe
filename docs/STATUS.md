# STATUS

> Resumable source of truth. Updated at the end of each step via `/session-report`.

## Where we are

- **Phase**: **Jalon 2 (« Séparation IA ») — separation runs on a local server**
  (PR #19 merged). The in-browser WASM engines hit a quality/speed ceiling; a
  local **FastAPI + Demucs** backend implements the `StemSeparator` port behind an
  HTTP contract and is now the **only** engine — the WASM adapters were removed
  (branch `chore/remove-wasm-separators`). J2.2 merged (PR #17); parallel
  separation + WAV export merged (PR #18). Plan in
  [docs/jalon-2-plan.md](jalon-2-plan.md). Jalon 1 is **complete + polished**.
  See [docs/jalon-1-plan.md](jalon-1-plan.md).
- **Branch**: `main` — Slice J2.3 merged (PR #21: adaptive instrument detection +
  server on `htdemucs_6s`). Next: browser-verify the 6-stem model, then Slice J2.4
  (multitrack mixer). **Scope change (2026-06-30): J2.5 track grouping is dropped**
  (low value) — Jalon 2 now ends at the mixer (J2.4) + export (J2.6).
- **Packages**: `@app/core` (pure hexagon — `loadTrack`, `Waveform`/`Track`,
  `transportReducer`/`formatTimecode`, `clampPlaybackRate`/`clampPitchSemitones`,
  `clampZoom`/`zoomIn`/`zoomOut`, `resolveCommand`/`defaultKeyBindings`,
  `TrackMetadataReader` port, `separateTrack`/`StemSeparator` port +
  `separationReducer`/`StemSet`, `encodeWav`/`decodeWav` WAV codec) + `packages/web`
  (import → … → stem separation via the HTTP `createSeparator` → local FastAPI +
  Demucs backend; per-stem WAV download; gate-green). The starter `@app/cli`/`greet`
  example and the in-browser WASM separators have been removed.

## Locked decisions (kickoff)

- **Time-stretch engine**: **SoundTouch** (`@soundtouchjs/audio-worklet`, MPL-2.0)
  — **REVISED (2026-06-28)**. Rubber Band was confirmed at Slice 3 start, but its
  only web wrapper (`rubberband-web`) crashes on live pitch change and is
  unmaintained; in-browser verification surfaced it. SoundTouch fixes the crash
  **and** lifts the GPL obligation — the product can ship under any licence.
- **Separation engine** — **REVISED (2026-06-30): a local server is now the default
  and required path.** In-browser WASM (demucs.cpp GGML / onnxruntime-web) hit a
  quality+speed wall (quantised models, wasm32 memory ceiling, no native GPU). A
  **FastAPI + Demucs** backend (`separator-server/`, GPU-capable, outside the
  hexagon) implements the same `StemSeparator` port via an HTTP/NDJSON contract;
  `createSeparator` returns the HTTP adapter. **The in-browser WASM engines were
  removed** (branch `chore/remove-wasm-separators`) — server-side Demucs is the
  single supported engine. htdemucs weights are research-only — fine for this
  non-commercial tool, not for a commercial product.
- **Web stack**: React + Jotai · Base UI (headless) · Every Layout · CSS Modules +
  CSS-variable tokens · smart/dumb components.
- **Extra gates** (blocking, `packages/web` only): impeccable + react-doctor.
- **Per-slice loop**: `/new-feature-hexa` → `/tdd-cycle` → `pnpm gate` →
  `pnpm test:mutation` → **`/code-review`** → `/session-report` → PR.

## Next step

**Slice J2.3 merged (PR #21).** Adaptive instrument detection lives in the pure
core (`stemEnergy` + `detectInstruments`): every `StemTrack` now carries a
`confidence` and a `present` flag, the `SeparationPanel` masks near-silent stems
and shows the rest with a teal confidence badge (absent ones named on a « Non
détectés » line). The server default model moved to **`htdemucs_6s`** so guitar +
piano split out of "other" (overridable via `DEMUCS_MODEL`). Gate green, core
mutation 95.62% (new files 100%). **Next**: browser-verify a real 6-stem
separation, then **Slice J2.4** (multitrack mixer — solo/mute/volume over a Web
Audio gain graph). **J2.5 (track grouping) is dropped**; Jalon 2 closes with the
mixer (J2.4) then export (J2.6). See
[docs/jalon-2-plan.md](jalon-2-plan.md).

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
| J2.2b | Server-side separation (FastAPI + Demucs) behind the `StemSeparator` port; HTTP/NDJSON, now the default engine | ✅ |
| J2.2c | Remove the superseded in-browser WASM separators (HTTP is the only engine) — −1598 lines | ✅ |
| J2.3 | Instrument detection → N adaptive tracks (mask empty, confidence) + server on `htdemucs_6s` (guitar/piano) | ✅ |
| J2.4 | Multitrack mixer (solo/mute/volume, Web Audio gain graph) | ⬜ |
| ~~J2.5~~ | ~~Track grouping (user bus, non-destructive)~~ — **dropped** (low value without enough perceived benefit) | 🚫 |
| J2.6 | Export — tier A: aligned stem folder (named WAVs, t=0, zipped) | ⬜ |

## Session journal

Dated reports under [docs/sessions/](sessions/). Most recent on top.

- [2026-06-30 — jalon2-instrument-detection](sessions/2026-06-30-jalon2-instrument-detection.md) —
  Slice J2.3: adaptive instrument detection. Pure core `stemEnergy` (RMS) +
  `detectInstruments` (energy relative to the loudest → `confidence` ∈ [0,1] +
  `present` above `PRESENCE_THRESHOLD`); `StemTrack` carries the verdict and
  `separateTrack` runs it. `SeparationPanel` masks near-silent stems, shows kept
  ones with a teal confidence badge, and names the masked ones on a « Non
  détectés » line. Server default model switched to `htdemucs_6s` so guitar +
  piano split out of "other" (the whole point of masking); `DEMUCS_MODEL` still
  overrides. Gate green, core mutation 95.62% (new files 100%). Real 6-stem
  browser-verify pending.
- [2026-06-30 — remove-wasm-separators](sessions/2026-06-30-remove-wasm-separators.md) —
  Removed the superseded in-browser WASM separators now that the HTTP separator
  (PR #19) is the only engine: GGML/ONNX adapters, workers, parallel/worker
  orchestrators, model-cache, resample, stem-layout, audio-format; vendored
  `public/demucs`/`public/ort` + build scripts; the `onnxruntime-web` dep;
  `create-separator` collapsed to a no-arg HTTP factory; and the now-dead core DSP
  (`segment-plan`, `overlap-add`) + their exports. Net −1598 lines across 25 files.
  Gate green, core mutation 95.37%. Next: Slice J2.3 / in-app per-stem playback.
- [2026-06-30 — jalon2-server-side-separation](sessions/2026-06-30-jalon2-server-side-separation.md) —
  Separation pivoted off the browser onto a local **FastAPI + Demucs** server,
  behind the same `StemSeparator` port. New pure core `decodeWav` (mutation
  96.67%), web `createHttpSeparator` adapter (mix → WAV POST → streamed NDJSON
  progress → fetch + decode stems), now the default `'http'` engine. Server runs
  `htdemucs` on the Apple GPU (MPS), re-orders stems to the UI layout, and streams
  genuine per-segment progress by intercepting Demucs' internal tqdm. Two real bugs
  found by testing (no `apply_model` callback; torchaudio 2.11 dropped its WAV
  backend). Browser-verified (~4-min track in ~38 s). Gate green, core mutation
  95.66%. Backend deliberately outside the hexagon. Follow-up: remove the
  superseded WASM engines in a separate PR.
- [2026-06-29 — jalon2-parallel-and-wav](sessions/2026-06-29-jalon2-parallel-and-wav.md) —
  Two separation enhancements behind the same `StemSeparator` port: **data-parallel
  GGML** (core `overlapAdd` + `planChunks`; N=`min(cores−1,4)` workers blend
  overlapping chunks) and **per-stem WAV export** (core `encodeWav` + retained PCM +
  « WAV ↓ » button) so stems can be heard. Browser-verified. High-effort review:
  no happy-path bug; fixed chunk-overlap cap, per-chunk windows, post-supersede
  rejection, progress phase, early `revokeObjectURL`. Gate green, core mutation
  94.24%. Orchestrator single/parallel consolidation noted as follow-up; in-app
  playback is the next slice.
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
