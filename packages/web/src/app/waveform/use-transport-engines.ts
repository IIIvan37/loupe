import {
  completesLoopPass,
  initialTransport,
  type LoopRegion,
  type PlaybackEngine,
  type StemPlaybackEngine,
  type TransportAction,
  type TransportState,
  transportReducer,
  wrapToLoop
} from '@app/core'
import { type Dispatch, useEffect, useReducer, useRef } from 'react'

/** The transport surface both engines share — what the active one is driven by. */
export type TransportControls = Pick<
  PlaybackEngine,
  'play' | 'pause' | 'seekTo' | 'setTimeRatio' | 'setPitchSemitones'
>

export interface TransportEngines {
  readonly transport: TransportState
  readonly dispatch: Dispatch<TransportAction>
  /** The engine the transport currently drives (the stem mix or the track). */
  readonly active: () => TransportControls
}

export interface TransportEnginesParams {
  readonly playback: PlaybackEngine
  readonly stemPlayback: StemPlaybackEngine
  /** Whether the multitrack mix drives the transport (vs the single track). */
  readonly stemsActive: boolean
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
  loopRegion,
  loopEnabled,
  onLoopWrap
}: TransportEnginesParams): TransportEngines {
  const [transport, dispatch] = useReducer(transportReducer, initialTransport)

  // Latest loop + enabled flag kept in refs so the (mount-once) position listener
  // never closes over stale values.
  const loopRef = useRef<LoopRegion | undefined>(undefined)
  loopRef.current = loopRegion
  const loopEnabledRef = useRef(true)
  loopEnabledRef.current = loopEnabled
  const onLoopWrapRef = useRef<(() => void) | undefined>(undefined)
  onLoopWrapRef.current = onLoopWrap
  // Which engine the transport drives, kept in a ref so the (mount-once) position
  // listener and the loop wrap-around always steer the live one.
  const stemsActiveRef = useRef(false)
  stemsActiveRef.current = stemsActive
  // The current playhead, so a transport hand-off can settle the new engine there.
  const positionRef = useRef(0)
  positionRef.current = transport.positionSeconds

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
        // The speed trainer counts completed passes only — a seek landing far
        // past the end wraps the playhead but earned nothing.
        if (completesLoopPass(loop, seconds)) {
          onLoopWrapRef.current?.()
        }
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

  return { transport, dispatch, active }
}
