import {
  type AudioFileDecoder,
  clampFineTuneCents,
  clampPitchSemitones,
  clampPlaybackRate,
  clampZoom,
  type DecodedAudio,
  fineTuneOrDefault,
  type LoopRegion,
  loadTrack,
  type PlaybackEngine,
  type ProjectTuning,
  percent,
  percentToRatio,
  ratio,
  ratioToPercent,
  type SpectrumFrame,
  type TrackMetadata,
  type TrackMetadataReader,
  type TransportState
} from '@app/core'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { useMemo, useRef } from 'react'
import { createMusicMetadataReader } from '../../audio/music-metadata-reader.ts'
import { createWebAudioDecoder } from '../../audio/playback/web-audio-decoder.ts'
import { createWebAudioPlayback } from '../../audio/playback/web-audio-playback.ts'
import { createWebAudioStemPlayback } from '../../audio/playback/web-audio-stem-playback.ts'
import type { ExternalValue } from '../../lib/external-value.ts'
import { useLatest } from '../../lib/use-latest.ts'
import {
  type PlaybackTransport,
  type PlayerHandle,
  useAudioSession,
  useStemTransport
} from '../audio-session/audio-session.ts'
import { useSpeedTrainer } from '../loops/use-speed-trainer.ts'
import { stemsActiveAtom } from '../mixer/mixer-atoms.ts'
import {
  loadedAudioAtom,
  loadedBytesAtom,
  NO_TRACK_METADATA,
  trackMetadataAtom
} from '../track/track-atoms.ts'
import {
  fineTuneCentsAtom,
  type ImportState,
  importStateAtom,
  pitchSemitonesAtom,
  timeRatioAtom
} from './player-atoms.ts'
import { useLoop } from './use-loop.ts'
import { useTransportEngines } from './use-transport-engines.ts'
import { viewportZoomAtom } from './viewport-atoms.ts'

/** Peak resolution: more buckets than screen pixels, so it stays crisp at 1×. */
const BUCKET_COUNT = 1200

export type { ImportState } from './player-atoms.ts'

export interface Player {
  readonly importState: ImportState
  readonly transport: TransportState
  /** The playhead, streamed outside React state — see TransportEngines. */
  readonly position: ExternalValue<number>
  /** Tempo as a ratio of normal speed (1 = 100 %). */
  readonly timeRatio: number
  /** The active A/B loop (the « loupe »), or undefined when off. */
  readonly loopRegion: LoopRegion | undefined
  /** Whether the active region actually loops playback (vs playing through). */
  readonly loopEnabled: boolean
  /** Every verb the player answers to, as a stable reference seated in the
   * session by the shell so the regions reach it themselves (ADR 0011). The
   * hook returns the state above and NO setter: one home per verb. */
  readonly handle: PlayerHandle
}

/**
 * Smart hook (= driving adapter logic): owns the import flow and steers the
 * playback engine port. The transport state machine + engine hand-off live in
 * {@link useTransportEngines}, and the A/B loop state in {@link useLoop}; this
 * hook wires them to the import flow and the tempo/pitch controls. The decoder
 * and engines default to the real Web Audio adapters and are injected in tests.
 *
 * Unified transport: once the mixer holds stems, the same play/pause/seek/
 * tempo/pitch controls drive the multitrack mix instead of the single track —
 * one playhead, one loop, for the whole mix. That fact is read from the mixer's
 * own atom (ADR 0010), not handed down by the shell. The mix is seen as a
 * {@link PlaybackTransport} only: this hook never loads a stem nor moves a
 * fader, so the single-track engine (which it does load and unload) is the one
 * port it still names whole.
 */
export function usePlayer(
  decoder?: AudioFileDecoder,
  engine?: PlaybackEngine,
  metadataReader?: TrackMetadataReader,
  stemEngine?: PlaybackTransport
): Player {
  const session = useAudioSession()
  const stemsActive = useAtomValue(stemsActiveAtom)
  const injectedDecoder = decoder ?? session.decoder
  const audioDecoder = useMemo(
    () => injectedDecoder ?? createWebAudioDecoder(),
    [injectedDecoder]
  )
  const injectedEngine = engine ?? session.engine
  const playback = useMemo(
    () => injectedEngine ?? createWebAudioPlayback(),
    [injectedEngine]
  )
  // The mix is reached as a transport: the player drives play/seek/tempo/pitch
  // and reads its spectrum — loading stems and moving faders belong to the
  // mixer, through its own slice of the same engine.
  const seatedStemTransport = useStemTransport()
  const injectedStemEngine = stemEngine ?? seatedStemTransport
  const stemPlayback = useMemo(
    () => injectedStemEngine ?? createWebAudioStemPlayback(),
    [injectedStemEngine]
  )
  const injectedReader = metadataReader ?? session.metadataReader
  const reader = useMemo(
    () => injectedReader ?? createMusicMetadataReader(),
    [injectedReader]
  )
  // The import lifecycle, the loaded track (PCM, bytes, tags) and the tuning
  // knobs (tempo, pitch, fine-tune) ride the features' atoms (ADR 0010): the
  // regions, the analyses and the project session read them on their own
  // instead of receiving them as props. This hook only WRITES the track's
  // tags and bytes.
  const [importState, setImportState] = useAtom(importStateAtom)
  const [loadedAudio, setLoadedAudio] = useAtom(loadedAudioAtom)
  const setLoadedBytes = useSetAtom(loadedBytesAtom)
  const setMetadata = useSetAtom(trackMetadataAtom)
  const [timeRatio, setTimeRatioState] = useAtom(timeRatioAtom)
  // Write-only here: the footer reads the two knobs from their atoms, so the
  // shell no longer re-renders on every slider notch.
  const setPitchSemitonesState = useSetAtom(pitchSemitonesAtom)
  const setFineTuneCentsState = useSetAtom(fineTuneCentsAtom)
  // The zoom is the viewport's atom, same feature: restoring a tuning seats
  // it alongside the three knobs, exactly as `tuningAtom` reads all four.
  const setZoom = useSetAtom(viewportZoomAtom)
  const loop = useLoop()
  // The ramp applies its earned tempo through the same clamped path the
  // slider uses (engines + read-out follow) — but through the INTERNAL
  // applier: the public setter is the user taking the tempo back, which
  // stops the ramp instead of fighting it. Arming memorises the current
  // tempo; stopping gives it back.
  const speedTrainer = useSpeedTrainer(
    (tempoPercent) => applyTimeRatio(percentToRatio(tempoPercent)),
    () => percent(Math.round(ratioToPercent(ratio(timeRatio))))
  )
  const { transport, dispatch, position, active } = useTransportEngines({
    playback,
    stemPlayback,
    stemsActive,
    trackAudio: loadedAudio,
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
    const fallback = fallbackMetadata ?? NO_TRACK_METADATA
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
          setFineTuneCents(0)
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
    // back from the ramp — the core's seam rule decides the ramp's fate.
    speedTrainer.cross('tempo-taken')
    applyTimeRatio(ratio)
  }

  /** The engines hear ONE pitch: semitones + cents/100 (SoundTouch takes the
   * fraction directly). The two knobs stay separate in state — the chart's
   * transposition arithmetic (N.3, modulo 12) reads whole semitones only.
   * The ref carries the pair so back-to-back setter calls in one render
   * (import reset, project restore) never apply a stale other-half. */
  const enginePitch = useRef({ semitones: 0, cents: 0 })

  function applyPitch(): void {
    const { semitones, cents } = enginePitch.current
    const shifted = semitones + cents / 100
    playback.setPitchSemitones(shifted)
    stemPlayback.setPitchSemitones(shifted)
  }

  function setPitchSemitones(semitones: number): void {
    const clamped = clampPitchSemitones(semitones)
    setPitchSemitonesState(clamped)
    enginePitch.current = { ...enginePitch.current, semitones: clamped }
    applyPitch()
  }

  function setFineTuneCents(cents: number): void {
    const clamped = clampFineTuneCents(cents)
    setFineTuneCentsState(clamped)
    enginePitch.current = { ...enginePitch.current, cents: clamped }
    applyPitch()
  }

  /** The exact inverse of `tuningAtom`: it seats the four knobs a manifest
   * carries, zoom included (the viewport's atom is this feature's too). */
  function restoreTuning(tuning: ProjectTuning): void {
    setTimeRatio(tuning.timeRatio)
    setPitchSemitones(tuning.pitchSemitones)
    setFineTuneCents(fineTuneOrDefault(tuning))
    setZoom(clampZoom(tuning.zoom))
  }

  function setLoopRegion(region: LoopRegion | undefined): void {
    // This path only clears or adjusts; REPLACING the passage is
    // useLoopEditing's seam ('loupe-selected'). The core rule decides which
    // seams the ramp survives.
    speedTrainer.cross(
      region === undefined ? 'loupe-cleared' : 'loupe-adjusted'
    )
    loop.setLoopRegion(region)
  }

  function toggleLoop(): void {
    speedTrainer.cross(
      loop.loopEnabled ? 'looping-disabled' : 'looping-enabled'
    )
    loop.toggleLoop()
  }

  function restoreLoop(region: LoopRegion, enabled: boolean): void {
    speedTrainer.cross('loupe-restored')
    loop.restoreLoop(region, enabled)
  }

  function readSpectrum(): SpectrumFrame | undefined {
    return stemsActive ? stemPlayback.spectrum?.() : playback.spectrum?.()
  }

  // The handle's methods delegate through refs so the object can keep ONE
  // identity for the whole session (the stable-reference contract of ADR
  // 0011) while the closures underneath stay render-fresh.
  const seekToSecondsRef = useLatest(seekToSeconds)
  const seekToRatioRef = useLatest(seekToRatio)
  const toggleLoopRef = useLatest(toggleLoop)
  const setLoopRegionRef = useLatest(setLoopRegion)
  const readSpectrumRef = useLatest(readSpectrum)
  const importFileRef = useLatest(importFile)
  const togglePlaybackRef = useLatest(togglePlayback)
  const setTimeRatioRef = useLatest(setTimeRatio)
  const setPitchSemitonesRef = useLatest(setPitchSemitones)
  const setFineTuneCentsRef = useLatest(setFineTuneCents)
  const restoreTuningRef = useLatest(restoreTuning)
  const restoreLoopRef = useLatest(restoreLoop)
  const {
    start: startTrainer,
    stop: stopTrainer,
    cross: crossTrainer
  } = speedTrainer
  const handle = useMemo<PlayerHandle>(
    () => ({
      position,
      readSpectrum: () => readSpectrumRef.current(),
      seekToSeconds: (seconds) => seekToSecondsRef.current(seconds),
      seekToRatio: (ratio) => seekToRatioRef.current(ratio),
      importFile: (file, fallbackMetadata) =>
        importFileRef.current(file, fallbackMetadata),
      togglePlayback: () => togglePlaybackRef.current(),
      setTimeRatio: (ratio) => setTimeRatioRef.current(ratio),
      setPitchSemitones: (semitones) => setPitchSemitonesRef.current(semitones),
      setFineTuneCents: (cents) => setFineTuneCentsRef.current(cents),
      restoreTuning: (tuning) => restoreTuningRef.current(tuning),
      restoreLoop: (region, enabled) => restoreLoopRef.current(region, enabled),
      toggleLoop: () => toggleLoopRef.current(),
      setLoopRegion: (region) => setLoopRegionRef.current(region),
      speedTrainer: {
        start: startTrainer,
        stop: stopTrainer,
        cross: crossTrainer
      }
    }),
    [position, startTrainer, stopTrainer, crossTrainer]
  )

  return {
    importState,
    transport,
    position,
    timeRatio,
    loopRegion: loop.loopRegion,
    loopEnabled: loop.loopEnabled,
    handle
  }
}
