# Application registry (use-cases + ports)

The single place to look before adding a feature, so ports and use-cases get
**reused, not reinvented** (`/new-feature-hexa`). Keep this in sync.

## Use-cases

| Use-case | Signature | Notes |
|----------|-----------|-------|
| `loadTrack` | `(input, deps) => Promise<LoadTrackResult>` | Slices 1–2 — decode bytes once via `AudioFileDecoder`, summarise into a `Track` (mono mix → `Waveform` peaks + duration), and load the same PCM into the `PlaybackEngine`. Also returns the decoded PCM so separation reuses the same audio (no second decode). |
| `separateTrack` | `(input, deps) => Promise<SeparateTrackResult>` | Slice J2.1 — hand the loaded PCM to the `StemSeparator` port and summarise each isolated stem into a render-ready `StemTrack` (`StemSet`); progress streams to an optional sink. Input is the SAME `DecodedAudio` the player loaded. **J2.3**: also runs adaptive detection — each stem carries a `confidence` and a `present` flag derived from its energy, so the UI can mask near-silent stems. |
| `saveProject` | `(input, deps) => Promise<SaveProjectResult>` | Slice J3.2 — persist the session as a project: `put` the heavy audio (source + stem WAV bytes) into `ProjectAudioStore` to mint refs, assemble the light `Project` via `projectFromSession`, `save` the manifest through `ProjectStore`. An inconsistent separation (mixer channels ≠ stems, `mixerMatchesStems`) is rejected before any byte is stored. Saving over an existing id is an update (`createdAt` survives, `updatedAt` = `stamp.now`). Also persists the armed A/B region (`ProjectActiveLoop` — the loupe, with its wrap choice), which needs no name to be worth keeping, the playback tuning (`ProjectTuning` — tempo/pitch/zoom as the user left them; `tuningOrDefault` reads an absent field on an old manifest as neutral), and the detected tempo (`ProjectTempo` — BPM + downbeat-flagged beat grid + the metronome stem's mixer settings, so a reopen re-synthesises the click without re-detecting). |
| `listProjects` | `(deps) => Promise<ListProjectsResult>` | Slice J3.2 — the saved manifests, most recently updated first. |
| `openProject` | `(input, deps) => Promise<OpenProjectResult>` | Slice J3.2 — load a manifest and resolve every `AudioRef` back to bytes (source + stems) so the caller can rebuild the working session; unknown id / dangling ref → error `Result`. |
| `deleteProject` | `(input, deps) => Promise<DeleteProjectResult>` | Slice J3.2 — remove a manifest. Its blobs become unreachable; reclaiming them is the audio-store adapter's business (later GC). |
| `renameProject` | `(input, deps) => Promise<RenameProjectResult>` | Jalon 3 polish — rename a stored project: `load` its manifest, give it the trimmed `name` and `now` as the new `updatedAt`, `save` it back. Audio refs are untouched (no byte moves). Blank name / unknown id → error `Result`. Name + clock injected. |
| `detectTempo` | `(input, deps) => Promise<DetectTempoResult>` | UX-backlog — hand the loaded PCM to the `TempoDetector` port and fold its beat instants into a downbeat-flagged `BeatGrid` (`buildBeatGrid`, meter assumed constant, grouped from the first beat) alongside the BPM. Input is the SAME `DecodedAudio` the player loaded. |
| `importFromUrl` | `(input, deps) => Promise<ImportFromUrlResult>` | Slice J4.1 — fetch a track from a media URL (YouTube / SoundCloud) through the `TrackSource` port and return its encoded bytes + metadata (title/artist/duration) for `loadTrack` to decode. An unsupported URL is rejected as a `Result` BEFORE the port is called (`isSupportedSourceUrl`, application policy — Spotify/Deezer excluded, their streams being DRM'd). Progress (`downloading` → `transcoding`) streams to an optional sink. |
| `exportStems` | `(input, deps) => Promise<ExportStemsResult>` | Slice J2.6 — export tier A: encode the given stems (the caller picks which, e.g. only the present ones; numbering follows the input order) as numbered 16-bit WAVs (`01_Voix.wav`…) padded to one shared duration (t=0 aligned), and bundle them through the `ArchiveWriter` port into the archive the caller downloads. |

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
> `wrapToLoop` / `loopLength`) and `LoopLibrary` (`addLoop` / `removeLoop`).
> Loops are session state, UI-driven (web `useLoops`); they persist only inside
> the project manifest (`LoopLibrary` is part of `Project`) — the former
> `LoopStore` port + localStorage adapter were removed with per-project loops.
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
> Pure instrument detection — Slice J2.3: `stemEnergy` (RMS loudness of a stem's
> channels) + `detectInstruments` (energy relative to the loudest stem →
> `confidence` in [0, 1] + a `present` flag above `PRESENCE_THRESHOLD`). The
> separator emits a fixed roster (htdemucs_6s: voice/drums/bass/guitar/piano/
> other) but a track rarely uses them all; detection masks the near-silent ones.
> `separateTrack` runs it so every `StemTrack` carries its verdict.
>
> Pure metronome domain — metronome slice: `synthesizeClickTrack(beats,
> durationSeconds, sampleRate)` renders a `BeatGrid` into a mono click PCM (a
> short decaying sine per beat, downbeats louder/higher, overlaps summed then
> clamped). The web wraps it into a mixer stem (`buildStemTrack`) so the click
> is configured like any other voice.
>
> Pure mixer domain — Slice J2.4: `mixerReducer` / `emptyMixer` drive the
> `MixerState` (one `MixerChannel` per stem: `gainDb` + `muted` + `soloed`;
> `addChannel` / `removeChannel` let a stem join or leave the mix — the
> metronome slice);
> `effectiveGains` folds the solo/mute rules into one linear gain per channel
> (mute silences itself, any solo silences the non-soloed, mute wins), the value
> both the gain graph and the fading waveforms read. `clampGainDb` /
> `dbToAmplitude` map the dB fader (`MIN_GAIN_DB`…`MAX_GAIN_DB`, `UNITY_GAIN_DB`)
> to a linear multiplier, the bottom of the fader being true silence.
> `combineWaveforms` sums the stem envelopes weighted by their effective gains
> into one (clamped to [-1, 1]) — the waveform of the **audible mix** the main
> view shows, recomputed as solo/mute/volume change. The web's `useMixer` hook
> owns the state, pushes the effective gains into the `StemPlaybackEngine`, and
> exposes that mix envelope plus the per-stem lanes.
>
> Pure WAV codec (no use-case/port, used by adapters) — `encodeWav` (Slice J2.2,
> per-stem export) serialises PCM to a 16-bit WAV; `decodeWav` (Slice J2.2b) is
> its inverse, parsing a WAV the HTTP separator fetched back into `DecodedAudio`.
>
> Pure stem-export domain — Slice J2.6: `stemExportFilename` (`01_Voix.wav`…,
> numbered in display order) and `padChannels` (bring every channel to one shared
> frame count — zero-pad or truncate — so all exported WAVs start at t=0 and last
> exactly as long). `exportStems` composes them with `encodeWav`.
>
> Pure project domain — Slice J3.1: `projectFromSession`
> assembles a `Project` (id/name/timestamps + `ProjectSource`, `LoopLibrary`,
> `MarkerList`, optional `ProjectActiveLoop` = the armed A/B region + wrap
> choice, optional `ProjectTuning` = tempo/pitch/zoom (with `tuningOrDefault`
> normalising manifests that predate the field to neutral), optional
> `ProjectSeparation` = stems + `MixerState`) from a
> `SessionSnapshot` and a caller-minted `ProjectStamp` (`id`/`name`/`now` — the
> core owns no clock or id generator). Heavy audio never enters the model: the
> source and each stem hold only an `AudioRef`, an opaque pointer a
> `ProjectAudioStore` adapter resolves to bytes. Slice J3.2 added the
> `ProjectStore` / `ProjectAudioStore` ports and the project use-cases above.

## Ports

| Port | Kind | Implemented by |
|------|------|----------------|
| `AudioFileDecoder` | driven | `web`: `createWebAudioDecoder` (`decodeAudioData`) |
| `PlaybackEngine` | driven | `web`: `createWebAudioPlayback` (`AudioBufferSourceNode` + SoundTouch worklet for tempo/pitch) |
| `StemPlaybackEngine` | driven | `web`: `createWebAudioStemPlayback` — synchronised multitrack playback (J2.4): a `GainNode` per stem summed into one SoundTouch master bus (tempo/pitch on the mix), `setGain` driven by the mixer's `effectiveGains`. `addStem` / `removeStem` join or drop one stem on the running mix (metronome slice) |
| `TrackMetadataReader` | driven | `web`: `createMusicMetadataReader` (music-metadata; best-effort ID3/etc. tags) |
| `TempoDetector` | driven | `web`: `createHttpTempoDetector` against the local server (mix → WAV POST `/tempo` → JSON `{ bpm, beats: [{ time, position }] }`, `position === 1` = downbeat; a legacy librosa server returning bare seconds is tolerated by counting). The core derives the grid + meter purely from the bar positions. A cloud API or an in-browser worker could be later adapters on the same port. |
| `TrackSource` | driven | `web`: `createHttpTrackSource` against the local server (J4.1 — `{url}` POST `/download` → streamed NDJSON progress → `done` line with a content-addressed `ref` the adapter `GET`s from `/audio/{ref}`, yielding encoded m4a/AAC bytes + metadata). The server runs **yt-dlp**; a cloud API could be a later adapter on the same port. |
| `StemSeparator` | driven | `web`: `createHttpSeparator` against a local **FastAPI + Demucs** backend (mix → WAV POST → streamed NDJSON progress → fetch + `decodeWav` stems — J2.2b). The earlier in-browser WASM engines (demucs.cpp GGML / onnxruntime-web) hit a quality+speed wall and were removed; a cloud API could be a later adapter on the same port. |
| `ProjectStore` | driven | `web`: `createHttpProjectStore` against the local server (J3.3 — JSON manifests under `LOUPE_DATA_DIR`). Light manifests: `list` / `load` (undefined for unknown id) / `save` / `delete`. |
| `ProjectAudioStore` | driven | `web`: `createHttpProjectAudioStore` (J3.3 — content-addressed sha256 blobs on the local server). Heavy bytes: `put` mints the `AudioRef` (its spelling is the adapter's business), `get` resolves it (undefined for unknown ref). |
| `ArchiveWriter` | driven | `web`: `createZipArchiveWriter` (fflate, entries stored uncompressed — WAV PCM barely deflates). Bundles the export's named files into one downloadable archive; the download itself stays in the adapter. |
