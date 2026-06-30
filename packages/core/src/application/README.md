# Application registry (use-cases + ports)

The single place to look before adding a feature, so ports and use-cases get
**reused, not reinvented** (`/new-feature-hexa`). Keep this in sync.

## Use-cases

| Use-case | Signature | Notes |
|----------|-----------|-------|
| `loadTrack` | `(input, deps) => Promise<LoadTrackResult>` | Slices 1–2 — decode bytes once via `AudioFileDecoder`, summarise into a `Track` (mono mix → `Waveform` peaks + duration), and load the same PCM into the `PlaybackEngine`. Also returns the decoded PCM so separation reuses the same audio (no second decode). |
| `loadLoops` / `saveLoop` / `deleteLoop` | `(…, deps) => Promise<LoopLibrary>` | Slice 5 — read/add/remove a saved loop via the `LoopStore` port (persistence best-effort). |
| `separateTrack` | `(input, deps) => Promise<SeparateTrackResult>` | Slice J2.1 — hand the loaded PCM to the `StemSeparator` port and summarise each isolated stem into a render-ready `StemTrack` (`StemSet`); progress streams to an optional sink. Input is the SAME `DecodedAudio` the player loaded. |

> Pure transport domain (no use-case, driven by the UI): `transportReducer` /
> `initialTransport` (`TransportState` machine), `formatTimecode` (m:ss), and the
> playback-parameter clamps `clampPlaybackRate` (tempo ratio) / `clampPitchSemitones`
> (semitones) — Slice 3.
>
> Pure marker domain (no use-case/port, UI-driven, in-memory) — Slice 4:
> `addMarker` / `removeMarker` / `emptyMarkerList` over a time-sorted `MarkerList`
> of `Marker` — a single named cue (bars/beats belong to later tempo detection).
>
> Pure loop domain — Slice 5: `LoopRegion` (`makeLoopRegion` / `loopContains` /
> `wrapToLoop` / `loopLength`) and `LoopLibrary` (`addLoop` / `removeLoop`); the
> `loops` use-cases above persist the library through the `LoopStore` port.
>
> Pure zoom domain (no use-case/port, UI-driven) — Slice 6: `clampZoom` /
> `zoomIn` / `zoomOut` over a `MIN_ZOOM…MAX_ZOOM` (1×–6×) scalar in `ZOOM_STEP`
> increments. Panning is the view's job (a native horizontal scroll over a
> zoom-scaled inner element), so the core only owns the magnification level.
>
> Pure keyboard domain (no use-case/port, UI-driven) — Slice 7: `resolveCommand`
> maps a `KeyChord` (code + modifiers) through `defaultKeyBindings` to a
> `Command` (`togglePlayback` / `seekBy` / `zoomIn` / `zoomOut` / `addMarker`).
> Matching is exact on code AND every modifier, so bare keys never hijack
> browser/OS chords. The web's `useKeyboardShortcuts` is the global-listener
> adapter that dispatches each command onto the smart hooks.
>
> Pure separation domain — Slice J2.1: `separationReducer` / `initialSeparation`
> drive the `SeparationState` machine (`idle → analysing → separating → ready |
> error`, clamped progress) the import → separation screen renders;
> `StemSet` / `StemTrack` are the render-ready result (`buildStemTrack` reuses the
> track mono-mix → waveform reduction). The web's `useSeparation` hook is the
> adapter that runs `separateTrack` and streams progress into the reducer.
>
> Pure WAV codec (no use-case/port, used by adapters) — `encodeWav` (Slice J2.2,
> per-stem export) serialises PCM to a 16-bit WAV; `decodeWav` (Slice J2.2b) is
> its inverse, parsing a WAV the HTTP separator fetched back into `DecodedAudio`.

## Ports

| Port | Kind | Implemented by |
|------|------|----------------|
| `AudioFileDecoder` | driven | `web`: `createWebAudioDecoder` (`decodeAudioData`) |
| `PlaybackEngine` | driven | `web`: `createWebAudioPlayback` (`AudioBufferSourceNode` + SoundTouch worklet for tempo/pitch) |
| `LoopStore` | driven | `web`: `createLocalStorageLoopStore` (localStorage) |
| `TrackMetadataReader` | driven | `web`: `createMusicMetadataReader` (music-metadata; best-effort ID3/etc. tags) |
| `StemSeparator` | driven | `web`: `createSeparator` picks the engine — default `'http'` `createHttpSeparator` (local **FastAPI + Demucs** backend; mix → WAV POST → streamed NDJSON progress → fetch + `decodeWav` stems — J2.2b). In-browser fallbacks: `createGgmlSeparator` (demucs.cpp WASM, fp16, data-parallel across N workers, blended by the core overlap-add) and `createDemucsSeparator` (htdemucs via onnxruntime-web), both slated for removal. Slice J2.2; a cloud API could be a later adapter on the same port. |
