# Application registry (use-cases + ports)

The single place to look before adding a feature, so ports and use-cases get
**reused, not reinvented** (`/new-feature-hexa`). Keep this in sync.

## Use-cases

| Use-case | Signature | Notes |
|----------|-----------|-------|
| `greet` | `(deps) => Promise<GreetResult>` | Example slice — load a name, build a greeting, emit it. |
| `loadTrack` | `(input, deps) => Promise<LoadTrackResult>` | Slices 1–2 — decode bytes once via `AudioFileDecoder`, summarise into a `Track` (mono mix → `Waveform` peaks + duration), and load the same PCM into the `PlaybackEngine`. |
| `loadLoops` / `saveLoop` / `deleteLoop` | `(…, deps) => Promise<LoopLibrary>` | Slice 5 — read/add/remove a saved loop via the `LoopStore` port (persistence best-effort). |

> Pure transport domain (no use-case, driven by the UI): `transportReducer` /
> `initialTransport` (`TransportState` machine), `formatTimecode` (m:ss), and the
> playback-parameter clamps `clampPlaybackRate` (tempo ratio) / `clampPitchSemitones`
> (semitones) — Slice 3.
>
> Pure marker domain (no use-case/port, UI-driven, in-memory) — Slice 4:
> `addMarker` / `removeMarker` / `emptyMarkerList` over a time-sorted `MarkerList`
> of `Marker` (`section` / `measure` / `beat`).
>
> Pure loop domain — Slice 5: `LoopRegion` (`makeLoopRegion` / `loopContains` /
> `wrapToLoop` / `loopLength`) and `LoopLibrary` (`addLoop` / `removeLoop`); the
> `loops` use-cases above persist the library through the `LoopStore` port.
>
> Pure zoom domain (no use-case/port, UI-driven) — Slice 6: `clampZoom` /
> `zoomIn` / `zoomOut` over a `MIN_ZOOM…MAX_ZOOM` (1×–6×) scalar in `ZOOM_STEP`
> increments. Panning is the view's job (a native horizontal scroll over a
> zoom-scaled inner element), so the core only owns the magnification level.

## Ports

| Port | Kind | Implemented by |
|------|------|----------------|
| `NameSource` | driving | `cli`: `ArgvNameSource` |
| `GreetingSink` | driven | `cli`: `ConsoleGreetingSink` |
| `AudioFileDecoder` | driven | `web`: `createWebAudioDecoder` (`decodeAudioData`) |
| `PlaybackEngine` | driven | `web`: `createWebAudioPlayback` (`AudioBufferSourceNode` + SoundTouch worklet for tempo/pitch) |
| `LoopStore` | driven | `web`: `createLocalStorageLoopStore` (localStorage) |
