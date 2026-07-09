import {
  type AudioFileDecoder,
  clampPitchSemitones,
  clampPlaybackRate,
  type DecodedAudio,
  type LoopRegion,
  loadTrack,
  type PlaybackEngine,
  type StemPlaybackEngine,
  type Track,
  type TrackMetadata,
  type TrackMetadataReader,
  type TransportState
} from '@app/core'
import { useMemo, useRef, useState } from 'react'
import { createMusicMetadataReader } from '../../audio/music-metadata-reader.ts'
import { createWebAudioDecoder } from '../../audio/web-audio-decoder.ts'
import { createWebAudioPlayback } from '../../audio/web-audio-playback.ts'
import { createWebAudioStemPlayback } from '../../audio/web-audio-stem-playback.ts'
import {
  type SpeedTrainer,
  useSpeedTrainer
} from '../loops/use-speed-trainer.ts'
import { useLoop } from './use-loop.ts'
import { useTransportEngines } from './use-transport-engines.ts'

const NO_METADATA: TrackMetadata = { title: undefined, artist: undefined }

/** Peak resolution: more buckets than screen pixels, so it stays crisp at 1×. */
const BUCKET_COUNT = 1200

export type ImportState =
  | { readonly status: 'idle' }
  | { readonly status: 'loading' }
  | { readonly status: 'loaded'; readonly track: Track }
  | { readonly status: 'error'; readonly message: string }

export interface Player {
  readonly importState: ImportState
  /** The decoded PCM of the loaded track, for reuse (stem separation). */
  readonly loadedAudio: DecodedAudio | undefined
  /** The imported file's original encoded bytes, for reuse (saving a project). */
  readonly loadedBytes: ArrayBuffer | undefined
  /** Tags read from the imported file (empty fields when the file has none). */
  readonly metadata: TrackMetadata
  readonly transport: TransportState
  /** Tempo as a ratio of normal speed (1 = 100 %). */
  readonly timeRatio: number
  /** Pitch shift in whole semitones (0 = original key). */
  readonly pitchSemitones: number
  /**
   * Import a file; resolves with its decoded PCM (undefined on failure).
   * `fallbackMetadata` seeds title/artist when the file carries no embedded
   * tags (e.g. a URL download supplying the source's own metadata).
   */
  readonly importFile: (
    file: File,
    fallbackMetadata?: TrackMetadata
  ) => Promise<DecodedAudio | undefined>
  readonly togglePlayback: () => void
  /** Seek to a fraction (0–1) of the timeline — what a waveform click yields. */
  readonly seekToRatio: (ratio: number) => void
  /** Seek to an absolute time in seconds (e.g. a marker). */
  readonly seekToSeconds: (seconds: number) => void
  readonly setTimeRatio: (ratio: number) => void
  readonly setPitchSemitones: (semitones: number) => void
  /** The active A/B loop (the « loupe »), or undefined when off. */
  readonly loopRegion: LoopRegion | undefined
  readonly setLoopRegion: (region: LoopRegion | undefined) => void
  /** Whether the active region actually loops playback (vs playing through). */
  readonly loopEnabled: boolean
  readonly toggleLoop: () => void
  /** Seat a persisted loupe: region and wrap choice together (project open). */
  readonly restoreLoop: (region: LoopRegion, enabled: boolean) => void
  /** The speed-trainer ramp riding the loupe (arms, steps on wraps, stops). */
  readonly speedTrainer: SpeedTrainer
}

/**
 * Smart hook (= driving adapter logic): owns the import flow and steers the
 * playback engine port. The transport state machine + engine hand-off live in
 * {@link useTransportEngines}, and the A/B loop state in {@link useLoop}; this
 * hook wires them to the import flow and the tempo/pitch controls. The decoder
 * and engines default to the real Web Audio adapters and are injected in tests.
 *
 * Unified transport: once `stemsActive` is set (the mixer has stems), the same
 * play/pause/seek/tempo/pitch controls drive the multitrack `StemPlaybackEngine`
 * instead of the single-track one — one playhead, one loop, for the whole mix.
 */
export function usePlayer(
  decoder?: AudioFileDecoder,
  engine?: PlaybackEngine,
  metadataReader?: TrackMetadataReader,
  stemEngine?: StemPlaybackEngine,
  stemsActive = false
): Player {
  const audioDecoder = useMemo(
    () => decoder ?? createWebAudioDecoder(),
    [decoder]
  )
  const playback = useMemo(() => engine ?? createWebAudioPlayback(), [engine])
  const stemPlayback = useMemo(
    () => stemEngine ?? createWebAudioStemPlayback(),
    [stemEngine]
  )
  const reader = useMemo(
    () => metadataReader ?? createMusicMetadataReader(),
    [metadataReader]
  )
  const [metadata, setMetadata] = useState<TrackMetadata>(NO_METADATA)
  const [importState, setImportState] = useState<ImportState>({
    status: 'idle'
  })
  const [loadedAudio, setLoadedAudio] = useState<DecodedAudio | undefined>(
    undefined
  )
  const [loadedBytes, setLoadedBytes] = useState<ArrayBuffer | undefined>(
    undefined
  )
  const [timeRatio, setTimeRatioState] = useState(1)
  const [pitchSemitones, setPitchSemitonesState] = useState(0)
  const loop = useLoop()
  // The ramp applies its earned tempo through the same clamped path the
  // slider uses (engines + read-out follow) — but through the INTERNAL
  // applier: the public setter is the user taking the tempo back, which
  // stops the ramp instead of fighting it.
  const speedTrainer = useSpeedTrainer((percent) =>
    applyTimeRatio(percent / 100)
  )
  const { transport, dispatch, active } = useTransportEngines({
    playback,
    stemPlayback,
    stemsActive,
    loopRegion: loop.loopRegion,
    loopEnabled: loop.loopEnabled,
    onLoopWrap: speedTrainer.recordPass
  })
  // Bumped per import so a slow metadata read from a previous file can't land on
  // top of the current one.
  const importIdRef = useRef(0)

  async function importFile(
    file: File,
    fallbackMetadata?: TrackMetadata
  ): Promise<DecodedAudio | undefined> {
    importIdRef.current += 1
    const importId = importIdRef.current
    setImportState({ status: 'loading' })
    // Show the fallback (a URL download's own title/artist) straight away; the
    // tag read below overrides only the fields it actually finds.
    const fallback = fallbackMetadata ?? NO_METADATA
    setMetadata(fallback)
    setLoadedAudio(undefined)
    setLoadedBytes(undefined)
    try {
      const bytes = await file.arrayBuffer()
      // Retain the original bytes from a copy — decoding may detach the buffer.
      // They are what a saved project stores as the source audio.
      const retained = bytes.slice(0)
      // Read tags best-effort and in parallel, from a copy — decoding may detach
      // the original buffer. Embedded tags win; the fallback fills what they
      // omit. A read from a superseded import is ignored.
      reader
        .read(retained.slice(0))
        .then((meta) => {
          if (importIdRef.current === importId) {
            setMetadata({
              title: meta.title ?? fallback.title,
              artist: meta.artist ?? fallback.artist
            })
          }
        })
        .catch(() => {})
      const result = await loadTrack(
        { bytes, bucketCount: BUCKET_COUNT },
        {
          decoder: audioDecoder,
          // A superseded import must not push its audio into the engine — the
          // newer import already owns it.
          engine: {
            ...playback,
            load: async (audio) => {
              if (importIdRef.current === importId) {
                await playback.load(audio)
              }
            }
          }
        }
      )
      // Apply the outcome only if no newer import took over during the decode
      // — the newer import owns the session now, success and error alike.
      if (importIdRef.current === importId) {
        if (result.ok) {
          setImportState({ status: 'loaded', track: result.track })
          setLoadedAudio(result.audio)
          setLoadedBytes(retained)
          setLoopRegion(undefined)
          // A fresh, unrelated track starts at its own tempo/pitch — the
          // previous track's tuning must not bleed in (and get saved with it).
          setTimeRatio(1)
          setPitchSemitones(0)
          dispatch({
            type: 'load',
            durationSeconds: result.track.durationSeconds
          })
          return result.audio
        }
        setImportState({ status: 'error', message: result.error })
      }
    } catch (e) {
      if (importIdRef.current === importId) {
        setImportState({
          status: 'error',
          message: e instanceof Error ? e.message : String(e)
        })
      }
    }
    return undefined
  }

  function togglePlayback(): void {
    if (importState.status !== 'loaded') {
      return
    }
    if (transport.isPlaying) {
      active().pause()
      dispatch({ type: 'pause' })
    } else {
      active().play()
      dispatch({ type: 'play' })
    }
  }

  function seekToSeconds(seconds: number): void {
    if (importState.status !== 'loaded') {
      return
    }
    active().seekTo(seconds)
    // The reducer clamps to [0, duration].
    dispatch({ type: 'seek', toSeconds: seconds })
  }

  function seekToRatio(ratio: number): void {
    const clamped = Math.min(Math.max(ratio, 0), 1)
    seekToSeconds(clamped * transport.durationSeconds)
  }

  function applyTimeRatio(ratio: number): void {
    const clamped = clampPlaybackRate(ratio)
    setTimeRatioState(clamped)
    // Keep both engines in step so tempo survives a transport hand-off.
    playback.setTimeRatio(clamped)
    stemPlayback.setTimeRatio(clamped)
  }

  function setTimeRatio(ratio: number): void {
    // A direct tempo change (slider, restore, import reset) takes authority
    // back from the ramp — a « running » read-out would lie about the tempo,
    // and the next earned step would snap the user's choice away.
    speedTrainer.stop()
    applyTimeRatio(ratio)
  }

  function setPitchSemitones(semitones: number): void {
    const clamped = clampPitchSemitones(semitones)
    setPitchSemitonesState(clamped)
    playback.setPitchSemitones(clamped)
    stemPlayback.setPitchSemitones(clamped)
  }

  function setLoopRegion(region: LoopRegion | undefined): void {
    // Clearing the loupe (discard, new import) ends the practice ramp — there
    // is no loop left to count passes on. Adjusting a region keeps it running;
    // REPLACING the passage stops it too, via useLoopEditing's seam.
    if (region === undefined) {
      speedTrainer.stop()
    }
    loop.setLoopRegion(region)
  }

  function toggleLoop(): void {
    // Turning looping off is play-through mode: no wrap can ever fire, so a
    // « running » ramp would sit dead while claiming progress.
    if (loop.loopEnabled) {
      speedTrainer.stop()
    }
    loop.toggleLoop()
  }

  function restoreLoop(region: LoopRegion, enabled: boolean): void {
    // A restored loupe (project open) never inherits the previous session's
    // ramp, whatever path seated it.
    speedTrainer.stop()
    loop.restoreLoop(region, enabled)
  }

  return {
    importState,
    loadedAudio,
    loadedBytes,
    metadata,
    transport,
    timeRatio,
    pitchSemitones,
    loopRegion: loop.loopRegion,
    importFile,
    togglePlayback,
    seekToRatio,
    seekToSeconds,
    setTimeRatio,
    setPitchSemitones,
    setLoopRegion,
    loopEnabled: loop.loopEnabled,
    toggleLoop,
    restoreLoop,
    speedTrainer
  }
}
