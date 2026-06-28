# Application registry (use-cases + ports)

The single place to look before adding a feature, so ports and use-cases get
**reused, not reinvented** (`/new-feature-hexa`). Keep this in sync.

## Use-cases

| Use-case | Signature | Notes |
|----------|-----------|-------|
| `greet` | `(deps) => Promise<GreetResult>` | Example slice — load a name, build a greeting, emit it. |
| `loadTrack` | `(input, deps) => Promise<LoadTrackResult>` | Slice 1 — decode bytes via the `AudioFileDecoder` port, summarise into a `Track` (mono mix → `Waveform` peaks + duration). |

## Ports

| Port | Kind | Implemented by |
|------|------|----------------|
| `NameSource` | driving | `cli`: `ArgvNameSource` |
| `GreetingSink` | driven | `cli`: `ConsoleGreetingSink` |
| `AudioFileDecoder` | driven | `web`: `createWebAudioDecoder` (`decodeAudioData`) |
