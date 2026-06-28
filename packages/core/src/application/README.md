# Application registry (use-cases + ports)

The single place to look before adding a feature, so ports and use-cases get
**reused, not reinvented** (`/new-feature-hexa`). Keep this in sync.

## Use-cases

| Use-case | Signature | Notes |
|----------|-----------|-------|
| `greet` | `(deps) => Promise<GreetResult>` | Example slice — load a name, build a greeting, emit it. |
| `loadTrack` | `(input, deps) => Promise<LoadTrackResult>` | Slices 1–2 — decode bytes once via `AudioFileDecoder`, summarise into a `Track` (mono mix → `Waveform` peaks + duration), and load the same PCM into the `PlaybackEngine`. |

> Pure transport domain (no use-case, driven by the UI): `transportReducer` /
> `initialTransport` (`TransportState` machine), `formatTimecode` (m:ss), and the
> playback-parameter clamps `clampPlaybackRate` (tempo ratio) / `clampPitchSemitones`
> (semitones) — Slice 3.

## Ports

| Port | Kind | Implemented by |
|------|------|----------------|
| `NameSource` | driving | `cli`: `ArgvNameSource` |
| `GreetingSink` | driven | `cli`: `ConsoleGreetingSink` |
| `AudioFileDecoder` | driven | `web`: `createWebAudioDecoder` (`decodeAudioData`) |
| `PlaybackEngine` | driven | `web`: `createWebAudioPlayback` (`AudioBufferSourceNode` + SoundTouch worklet for tempo/pitch) |
