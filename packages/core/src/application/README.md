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
| `detectTempo` | `(input, deps) => Promise<DetectTempoResult>` | UX-backlog, enriched by tempo Lot B — hand the loaded PCM to the `TempoDetector` port; its positioned beats (`barPosition`, 1 = downbeat) fold into a downbeat-flagged `BeatGrid` (`buildBeatGrid`) and the meter derives as `detectMeter` = max bar position, alongside the representative BPM. Input is the SAME `DecodedAudio` the player loaded. Related pure domain: `foldTempoOctave` (manual ×2/÷2 octave correction preserving downbeat phase), `buildTempoMap` / `tempoAt` (tempo Lot C — steady-tempo segments derived from the grid's beat gaps with a confirmed-rupture tolerance, and the felt bpm at an instant, for the playhead read-out on tempo-varying tracks). |
| `detectChords` | `(input, deps) => Promise<DetectChordsResult>` | Chord-charts Lot C — hand the loaded PCM to the `ChordDetector` port and fold its timestamped spans into ONE chord per measure on the beat grid (`chordLabelPerMeasure`, pure: duration-weighted vote per downbeat→downbeat interval — the beat-sync the engines don't provide), then deduce the song's structure from the repetition in that sequence (`deduceStructure`, P.4: MDL tiling over common section lengths, fuzzy 3/4 block matching, majority-vote cleaning across occurrences) and render it as grid SOURCE text (`renderStructuredSource` — `[A]`/`[B]` headers, adjacent duplicate pairs folded into `|: … :|`). The draft is then re-spelled under the detected key (`detectKey` — Krumhansl correlation over the chords' held-weighted pitch classes → `keyAccidental` → `respellChartSource`, so a flat key reads `Bb`, not the engine's `A#`) and headed with the detected `{key: …}` directive — the draft the chord-chart editor pre-fills and the user corrects. A grid without downbeats is rejected before the port is called; an empty detection is an error (never a chart-wiping empty draft). Input is the SAME `DecodedAudio` the player loaded. |
| `detectStructure` | `(input, deps) => Promise<DetectStructureResult>` | Structure Lot P.4 phase 2 — hand the loaded PCM to the `StructureDetector` port and snap the functional sections it returns onto the beat grid (`snapSectionsToGrid`, pure: measured rules — snap a boundary to the nearest downbeat within one bar, keep the first at 0 and the last at the track end, collapse sub-bar sections) so sections start on measures. Unlike `detectChords` it does NOT require a grid: the « detect structure » button places markers even before the tempo is known, so an empty grid just skips snapping. An empty detection is an error (nothing to mark). Input is the SAME `DecodedAudio` the player loaded. |
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
> Pure speed-trainer domain (no use-case/port, UI-driven) — roadmap-2 Lot I.1:
> `startSpeedTrainer(policy)` / `recordLoopPass(state)` — the practice ramp
> riding the loupe. Percent-grained tempo (the transport control's grain,
> `MIN/MAX_TEMPO_PERCENT`) climbing `incrementPercent` every `passesPerStep`
> completed loop passes, capped at `targetPercent`; the policy is normalised
> on arm (tempos confined to the playable range — clamped natively in percent
> space, `NaN` reads as full speed —, target lifted to the start, increment
> and cadence floored). `completesLoopPass(region, seconds)` tells a
> played-through pass from a corrective wrap after a seek. The web's
> `useSpeedTrainer` records each completed pass from the transport's position
> listener (`onLoopWrap`) and lands every earned step on the player; the ramp
> stops whenever its premise dies — the loupe cleared or replaced, looping
> toggled off, or the user taking the tempo back on the slider.
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
> Pure chord-chart domain (no use-case/port, UI-driven) — chord-charts lots +
> lead-sheet Lot P: `parseChart(text) → ChordChart` over the home grid grammar —
> head `{key: value}` directives, `[Section]` labels, `| C | Am |` rows
> (`parseChordSymbol` per token) — and its inverse `renderChartSource` (the
> detection draft printer; a label the grammar would misread prints as `N.C.`).
> `transposeChartSource` / `transposeChart` rewrite the SOURCE text (layout
> preserved, lossy tokens verbatim, `{key: …}` follows) with `transposedBy` as
> the key accounting, `chartMatchesPitch` compares it to the audio shift mod 12.
> **Form grammar (P.2)** (structural tokens are space-separated): repeats
> `|: … :|` (a bare `:|` repeats from after the previous close, else the top;
> nesting is unsupported — the inner repeat wins), voltas `|1. … :| |2. …` —
> a volta number spans its ROW up to and including the bar its `:|` closes,
> each ending plays on its own pass, an orphan volta plays only its first
> ending — full-line marks `{d.c.}` (replay from the top, repeats honoured as
> written; its position doubles as the to-coda point, and without a coda the
> replay simply plays on through the tail) / `{coda}` (played only via the
> jump) / `{fine}` (ends the replay — wins over a contradictory coda), and a
> `@` token suffix for a fermata on the measure.
> `unrollChart(chart)` flattens the form into the played sequence of written
> measure indices — the projection the playhead highlight follows (the n-th
> downbeat plays the n-th unrolled measure).
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
| `ChordDetector` | driven | `web` (next slice): `createHttpChordDetector` against the local server (mix → WAV POST `/chords` → JSON timestamped spans). Spans are NOT beat-synchronised — the core folds them onto the grid — and the adapter translates engine syntax (mir `A:min`) into grid tokens (`Am`). Engine: BTC (MIT), `voca=False`. |
| `StructureDetector` | driven | `web` (next slice): `createHttpStructureDetector` against the local server (mix → WAV POST `/structure` → JSON `{ segments: [{ start, end, label }] }`, raw seconds). Sections are NOT beat-synchronised — the core snaps them onto the grid. Engine: SongFormer (CC-BY-4.0), chunked inference, vendored server-side. |
| `TrackSource` | driven | `web`: `createHttpTrackSource` against the local server (J4.1 — `{url}` POST `/download` → streamed NDJSON progress → `done` line with a content-addressed `ref` the adapter `GET`s from `/audio/{ref}`, yielding encoded m4a/AAC bytes + metadata). The server runs **yt-dlp**; a cloud API could be a later adapter on the same port. |
| `StemSeparator` | driven | `web`: `createHttpSeparator` against a local **FastAPI + Demucs** backend (mix → WAV POST → streamed NDJSON progress → fetch + `decodeWav` stems — J2.2b). The earlier in-browser WASM engines (demucs.cpp GGML / onnxruntime-web) hit a quality+speed wall and were removed; a cloud API could be a later adapter on the same port. |
| `ProjectStore` | driven | `web`: `createHttpProjectStore` against the local server (J3.3 — JSON manifests under `LOUPE_DATA_DIR`). Light manifests: `list` / `load` (undefined for unknown id) / `save` / `delete`. |
| `ProjectAudioStore` | driven | `web`: `createHttpProjectAudioStore` (J3.3 — content-addressed sha256 blobs on the local server). Heavy bytes: `put` mints the `AudioRef` (its spelling is the adapter's business), `get` resolves it (undefined for unknown ref). |
| `ArchiveWriter` | driven | `web`: `createZipArchiveWriter` (fflate, entries stored uncompressed — WAV PCM barely deflates). Bundles the export's named files into one downloadable archive; the download itself stays in the adapter. |
