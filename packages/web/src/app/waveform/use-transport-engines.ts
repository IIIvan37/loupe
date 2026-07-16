import {
  completesLoopPass,
  type DecodedAudio,
  initialTransport,
  type LoopRegion,
  type PlaybackEngine,
  type StemPlaybackEngine,
  type TransportAction,
  type TransportState,
  transportReducer,
  wrapToLoop
} from '@app/core'
import {
  type Dispatch,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef
} from 'react'
import {
  createExternalValue,
  type ExternalValue
} from '../../lib/external-value.ts'
import { useLatest } from '../../lib/use-latest.ts'

/** The transport surface both engines share — what the active one is driven by. */
export type TransportControls = Pick<
  PlaybackEngine,
  'play' | 'pause' | 'seekTo' | 'setTimeRatio' | 'setPitchSemitones'
>

export interface TransportEngines {
  readonly transport: TransportState
  readonly dispatch: Dispatch<TransportAction>
  /**
   * The playhead, streamed at animation-frame rate OUTSIDE React state (Lot
   * L.1): a tick re-renders nothing by itself — consumers subscribe to the
   * derived slice they need (timecode second, measure index, playhead ratio).
   */
  readonly position: ExternalValue<number>
  /** The engine the transport currently drives (the stem mix or the track). */
  readonly active: () => TransportControls
}

export interface TransportEnginesParams {
  readonly playback: PlaybackEngine
  readonly stemPlayback: StemPlaybackEngine
  /** Whether the multitrack mix drives the transport (vs the single track). */
  readonly stemsActive: boolean
  /**
   * The kept PCM of the single track. The hand-off to the mix unloads the
   * track engine (its buffer is dead weight while the mix plays — V.2); the
   * hand-back reads this to reload it lazily before restoring the playhead.
   * Read at hand-back time, never a dep — the hand-off effect must fire on
   * engine switches only, not on imports.
   */
  readonly trackAudio: DecodedAudio | undefined
  /** The live A/B loop — playback wraps to its start when it reaches the end. */
  readonly loopRegion: LoopRegion | undefined
  readonly loopEnabled: boolean
  /** Notified on each wrap-around — one completed loop pass (speed trainer). */
  readonly onLoopWrap?: () => void
}

/**
 * The two playback engines under one transport: the reducer state machine, which
 * engine is live, the loop wrap-around on the streamed position, and the hand-off
 * that moves the playhead when the mix takes over (or hands back to the track).
 *
 * The position listener and the hand-off are mount-once effects, so every value
 * they read (the live loop, which engine is active, the current playhead) is kept
 * in a ref that the render refreshes — the closures never see a stale value.
 */
export function useTransportEngines({
  playback,
  stemPlayback,
  stemsActive,
  trackAudio,
  loopRegion,
  loopEnabled,
  onLoopWrap
}: TransportEnginesParams): TransportEngines {
  const [transport, reduce] = useReducer(transportReducer, initialTransport)
  // The playhead lives OUTSIDE the reducer: engines stream it per animation
  // frame, and routing that through React state re-rendered the whole
  // workstation on every frame (Lot L.1). The store carries the raw engine
  // truth; display consumers clamp for themselves.
  const position = useMemo(() => createExternalValue(0), [])
  // Seeks and loads still go through the reducer for control state — mirror
  // them into the store so both views of the playhead always agree.
  const dispatch: Dispatch<TransportAction> = useCallback(
    (action) => {
      if (action.type === 'seek') {
        position.set(action.toSeconds)
      } else if (action.type === 'load') {
        position.set(0)
      }
      reduce(action)
    },
    [position]
  )

  // Latest loop + enabled flag kept in refs so the (mount-once) position listener
  // never closes over stale values.
  const loopRef = useLatest(loopRegion)
  const loopEnabledRef = useLatest(loopEnabled)
  const onLoopWrapRef = useLatest(onLoopWrap)
  // Which engine the transport drives, kept in a ref so the (mount-once) position
  // listener and the loop wrap-around always steer the live one.
  const stemsActiveRef = useLatest(stemsActive)
  // Timeline bounds + play state for the (mount-once) listener: reaching the
  // end must stop playback, which used to be the reducer's 'tick' job.
  const durationRef = useLatest(transport.durationSeconds)
  const isPlayingRef = useLatest(transport.isPlaying)
  const trackAudioRef = useLatest(trackAudio)

  /** The engine the transport currently drives (the stem mix or the track). */
  const active = (): TransportControls =>
    stemsActiveRef.current ? stemPlayback : playback

  useEffect(() => {
    // Both engines stream elapsed position; only the playing one ticks. Ticks
    // land in the position store — NOT the reducer — so a frame re-renders
    // only the components whose derived slice of the playhead moved.
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
        // The speed trainer counts completed passes only — a seek landing far
        // past the end wraps the playhead but earned nothing.
        if (completesLoopPass(loop, seconds)) {
          onLoopWrapRef.current?.()
        }
        return
      }
      position.set(seconds)
      // Reaching the end of a real timeline stops playback — the reducer's old
      // 'tick' job, now the listener's (the only frame that changes UI state).
      if (
        isPlayingRef.current &&
        durationRef.current > 0 &&
        seconds >= durationRef.current
      ) {
        dispatch({ type: 'pause' })
      }
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
  }, [playback, stemPlayback, dispatch, position])

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
    const at = position.get()
    if (stemsActive) {
      stemPlayback.seekTo(at)
      // The mix drives the transport now: the track engine's buffer (~85 MB
      // of float32 for 4 min) is dead weight until a hand-back — release it.
      playback.unload()
    } else {
      // Reload lazily from the kept PCM (when there is none — mid-import — the
      // engine stays inert until the import's own load). Then hand the engine
      // back where the session actually is: the LIVE playhead and play state,
      // since both may have moved while the reload was in flight and the
      // buffer-less engine could not honour them. Skipped when this hand-back
      // no longer owns the engine — a new import (the PCM changed) or a
      // re-hand-off superseded the reload.
      const audio = trackAudioRef.current
      if (audio) {
        playback
          .load(audio)
          .then(() => {
            if (trackAudioRef.current !== audio || stemsActiveRef.current) {
              return
            }
            playback.seekTo(position.get())
            if (isPlayingRef.current) {
              playback.play()
            }
          })
          .catch(() => {
            // The port allows a rejecting load (see loadTrack); a failed
            // reload leaves the engine inert and the user re-imports —
            // nothing to surface here.
          })
      }
    }
    dispatch({ type: 'pause' })
  }, [stemsActive, playback, stemPlayback, dispatch, position])

  return { transport, dispatch, position, active }
}
