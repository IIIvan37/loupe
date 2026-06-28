import {
  type AudioFileDecoder,
  clampPitchSemitones,
  clampPlaybackRate,
  initialTransport,
  type LoopRegion,
  loadTrack,
  type PlaybackEngine,
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
  /** Tags read from the imported file (empty fields when the file has none). */
  readonly metadata: TrackMetadata
  readonly transport: TransportState
  /** Tempo as a ratio of normal speed (1 = 100 %). */
  readonly timeRatio: number
  /** Pitch shift in whole semitones (0 = original key). */
  readonly pitchSemitones: number
  readonly importFile: (file: File) => Promise<void>
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
}

/**
 * Smart hook (= driving adapter logic): owns the import flow and the transport
 * state machine, and steers the playback engine port. The decoder and engine
 * default to the real Web Audio adapters and are injected in tests.
 */
export function usePlayer(
  decoder?: AudioFileDecoder,
  engine?: PlaybackEngine,
  metadataReader?: TrackMetadataReader
): Player {
  const audioDecoder = useMemo(
    () => decoder ?? createWebAudioDecoder(),
    [decoder]
  )
  const playback = useMemo(() => engine ?? createWebAudioPlayback(), [engine])
  const reader = useMemo(
    () => metadataReader ?? createMusicMetadataReader(),
    [metadataReader]
  )
  const [metadata, setMetadata] = useState<TrackMetadata>(NO_METADATA)
  const [importState, setImportState] = useState<ImportState>({
    status: 'idle'
  })
  const [transport, dispatch] = useReducer(transportReducer, initialTransport)
  const [timeRatio, setTimeRatioState] = useState(1)
  const [pitchSemitones, setPitchSemitonesState] = useState(0)
  const [loopRegion, setLoopRegionState] = useState<LoopRegion | undefined>(
    undefined
  )
  // Latest loop kept in a ref so the (mount-once) position listener never closes
  // over a stale region.
  const loopRef = useRef<LoopRegion | undefined>(undefined)
  loopRef.current = loopRegion

  useEffect(() => {
    // The engine streams elapsed position; the reducer turns it into UI state.
    const unsubscribe = playback.onPositionChange((seconds) => {
      const loop = loopRef.current
      // Guard a degenerate (zero-length) loop, which would otherwise wrap-seek
      // every frame.
      if (
        loop &&
        loop.endSeconds > loop.startSeconds &&
        wrapToLoop(loop, seconds) !== seconds
      ) {
        // Reached the loop end → jump back to its start.
        playback.seekTo(loop.startSeconds)
        dispatch({ type: 'seek', toSeconds: loop.startSeconds })
        return
      }
      dispatch({ type: 'tick', atSeconds: seconds })
    })
    // On unmount, stop the engine too: pausing cancels its animation-frame loop
    // and the sound, so nothing keeps running once the player is gone.
    return () => {
      unsubscribe()
      playback.pause()
    }
  }, [playback])

  async function importFile(file: File): Promise<void> {
    setImportState({ status: 'loading' })
    setMetadata(NO_METADATA)
    try {
      const bytes = await file.arrayBuffer()
      // Read tags best-effort and in parallel, from a copy — decoding may detach
      // the original buffer. A tagless/unreadable file just keeps empty fields.
      void reader
        .read(bytes.slice(0))
        .then(setMetadata)
        .catch(() => setMetadata(NO_METADATA))
      const result = await loadTrack(
        { bytes, bucketCount: BUCKET_COUNT },
        { decoder: audioDecoder, engine: playback }
      )
      if (result.ok) {
        setImportState({ status: 'loaded', track: result.track })
        setLoopRegionState(undefined)
        dispatch({
          type: 'load',
          durationSeconds: result.track.durationSeconds
        })
      } else {
        setImportState({ status: 'error', message: result.error })
      }
    } catch (e) {
      setImportState({
        status: 'error',
        message: e instanceof Error ? e.message : String(e)
      })
    }
  }

  function togglePlayback(): void {
    if (importState.status !== 'loaded') {
      return
    }
    if (transport.isPlaying) {
      playback.pause()
      dispatch({ type: 'pause' })
    } else {
      playback.play()
      dispatch({ type: 'play' })
    }
  }

  function seekToSeconds(seconds: number): void {
    if (importState.status !== 'loaded') {
      return
    }
    playback.seekTo(seconds)
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
    playback.setTimeRatio(clamped)
  }

  function setPitchSemitones(semitones: number): void {
    const clamped = clampPitchSemitones(semitones)
    setPitchSemitonesState(clamped)
    playback.setPitchSemitones(clamped)
  }

  function setLoopRegion(region: LoopRegion | undefined): void {
    setLoopRegionState(region)
  }

  return {
    importState,
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
    setLoopRegion
  }
}
