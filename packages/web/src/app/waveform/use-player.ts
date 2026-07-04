import {
  type AudioFileDecoder,
  clampPitchSemitones,
  clampPlaybackRate,
  type DecodedAudio,
  initialTransport,
  type LoopRegion,
  loadTrack,
  type PlaybackEngine,
  type StemPlaybackEngine,
  type Track,
  type TrackMetadata,
  type TrackMetadataReader,
  type TransportState,
  transportReducer,
  wrapToLoop
} from '@app/core'
import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { createMusicMetadataReader } from '../../audio/music-metadata-reader.ts'
import { createWebAudioDecoder } from '../../audio/web-audio-decoder.ts'
import { createWebAudioPlayback } from '../../audio/web-audio-playback.ts'
import { createWebAudioStemPlayback } from '../../audio/web-audio-stem-playback.ts'

const NO_METADATA: TrackMetadata = { title: undefined, artist: undefined }

/** Peak resolution: more buckets than screen pixels, so it stays crisp at 1×. */
const BUCKET_COUNT = 1200

/** The transport surface both engines share — what the active one is driven by. */
type TransportControls = Pick<
  PlaybackEngine,
  'play' | 'pause' | 'seekTo' | 'setTimeRatio' | 'setPitchSemitones'
>

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
}

/**
 * Smart hook (= driving adapter logic): owns the import flow and the transport
 * state machine, and steers the playback engine port. The decoder and engines
 * default to the real Web Audio adapters and are injected in tests.
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
  const [transport, dispatch] = useReducer(transportReducer, initialTransport)
  const [timeRatio, setTimeRatioState] = useState(1)
  const [pitchSemitones, setPitchSemitonesState] = useState(0)
  const [loopRegion, setLoopRegionState] = useState<LoopRegion | undefined>(
    undefined
  )
  const [loopEnabled, setLoopEnabledState] = useState(true)
  // Latest loop + enabled flag kept in refs so the (mount-once) position listener
  // never closes over stale values.
  const loopRef = useRef<LoopRegion | undefined>(undefined)
  loopRef.current = loopRegion
  const loopEnabledRef = useRef(true)
  loopEnabledRef.current = loopEnabled
  // Which engine the transport drives, kept in a ref so the (mount-once) position
  // listener and the loop wrap-around always steer the live one.
  const stemsActiveRef = useRef(false)
  stemsActiveRef.current = stemsActive
  // The current playhead, so a transport hand-off can settle the new engine there.
  const positionRef = useRef(0)
  positionRef.current = transport.positionSeconds
  // Bumped per import so a slow metadata read from a previous file can't land on
  // top of the current one.
  const importIdRef = useRef(0)

  /** The engine the transport currently drives (the stem mix or the track). */
  const active = (): TransportControls =>
    stemsActiveRef.current ? stemPlayback : playback

  useEffect(() => {
    // Both engines stream elapsed position; only the playing one ticks. The
    // reducer turns it into UI state, the same way whichever drives the transport.
    const onPosition = (seconds: number) => {
      const loop = loopRef.current
      // Guard a degenerate (zero-length) loop, which would otherwise wrap-seek
      // every frame. Looping must also be enabled — otherwise play straight on.
      if (
        loop &&
        loopEnabledRef.current &&
        loop.endSeconds > loop.startSeconds &&
        wrapToLoop(loop, seconds) !== seconds
      ) {
        // Reached the loop end → jump back to its start, on the live engine.
        const engine = stemsActiveRef.current ? stemPlayback : playback
        engine.seekTo(loop.startSeconds)
        dispatch({ type: 'seek', toSeconds: loop.startSeconds })
        return
      }
      dispatch({ type: 'tick', atSeconds: seconds })
    }
    const unsubscribe = playback.onPositionChange(onPosition)
    const unsubscribeStems = stemPlayback.onPositionChange(onPosition)
    // On unmount, stop both engines too: pausing cancels the animation-frame loop
    // and the sound, so nothing keeps running once the player is gone.
    return () => {
      unsubscribe()
      unsubscribeStems()
      playback.pause()
      stemPlayback.pause()
    }
  }, [playback, stemPlayback])

  // Whether stems drove the transport on the previous render, so the hand-off
  // runs only on a real switch — never on mount, where there is nothing to move.
  const handedToStemsRef = useRef(stemsActive)

  useEffect(() => {
    if (handedToStemsRef.current === stemsActive) {
      return
    }
    handedToStemsRef.current = stemsActive
    // Hand the transport between the single track and the stem mix. Settle both
    // paused at the current playhead on whichever is now active, so the next play
    // starts cleanly and in the right place.
    playback.pause()
    stemPlayback.pause()
    const at = positionRef.current
    if (stemsActive) {
      stemPlayback.seekTo(at)
    } else {
      playback.seekTo(at)
    }
    dispatch({ type: 'pause' })
  }, [stemsActive, playback, stemPlayback])

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
          setLoopRegionState(undefined)
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

  function setTimeRatio(ratio: number): void {
    const clamped = clampPlaybackRate(ratio)
    setTimeRatioState(clamped)
    // Keep both engines in step so tempo survives a transport hand-off.
    playback.setTimeRatio(clamped)
    stemPlayback.setTimeRatio(clamped)
  }

  function setPitchSemitones(semitones: number): void {
    const clamped = clampPitchSemitones(semitones)
    setPitchSemitonesState(clamped)
    playback.setPitchSemitones(clamped)
    stemPlayback.setPitchSemitones(clamped)
  }

  function setLoopRegion(region: LoopRegion | undefined): void {
    // Selecting a region where there was none re-arms looping, so a fresh loupe
    // loops straight away; adjusting an existing region leaves the choice alone.
    if (loopRegion === undefined && region !== undefined) {
      setLoopEnabledState(true)
    }
    setLoopRegionState(region)
  }

  function toggleLoop(): void {
    setLoopEnabledState((enabled) => !enabled)
  }

  /**
   * Seat a persisted loupe exactly as saved: region AND wrap choice together,
   * bypassing the fresh-selection re-arm heuristic of `setLoopRegion`.
   */
  function restoreLoop(region: LoopRegion, enabled: boolean): void {
    setLoopRegionState(region)
    setLoopEnabledState(enabled)
  }

  return {
    importState,
    loadedAudio,
    loadedBytes,
    metadata,
    transport,
    timeRatio,
    pitchSemitones,
    loopRegion,
    importFile,
    togglePlayback,
    seekToRatio,
    seekToSeconds,
    setTimeRatio,
    setPitchSemitones,
    setLoopRegion,
    loopEnabled,
    toggleLoop,
    restoreLoop
  }
}
