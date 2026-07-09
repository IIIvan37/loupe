import {
  buildCountIn,
  buildTempoMap,
  type CountIn,
  effectiveGains,
  type MixerState,
  type TempoAnalysis,
  tempoAt
} from '@app/core'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createCountInPlayer } from '../../audio/count-in-player.ts'
import { METRONOME_ID } from './metronome-stem.ts'

/**
 * Plays one bar of clicks out of band (the transport hasn't started yet) and
 * reports back when it ends. Returns a cancel that silences the clicks without
 * firing `onEnded`.
 */
export interface CountInPlayer {
  readonly play: (countIn: CountIn, onEnded: () => void) => () => void
}

export interface CountInParams {
  /** Whether the transport can start at all (a track is loaded). */
  readonly canPlay: boolean
  readonly isPlaying: boolean
  /** Where playback will start — the count-in matches the tempo felt there. */
  readonly positionSeconds: number
  /** Tempo as a ratio of normal speed — the count matches the HEARD tempo. */
  readonly timeRatio: number
  readonly analysis: TempoAnalysis | undefined
  readonly metronomeEnabled: boolean
  /** The live mixer channels — the count-in follows the click lane's mute/solo. */
  readonly mixerState: MixerState
  /** The raw transport toggle the count-in defers. */
  readonly togglePlayback: () => void
  /** Injected in tests; defaults to the real Web Audio one-shot player. */
  readonly player?: CountInPlayer | undefined
}

export interface CountInTransport {
  /** Whether a count-in is sounding (the transport is about to start). */
  readonly countingIn: boolean
  /** Play/pause with the count-in in front of every start. */
  readonly togglePlayback: () => void
}

/**
 * Smart hook: the metronome's count-in. Starting playback while the click lane
 * is audible first plays one bar of clicks at the tempo felt at the playhead
 * (stretched by the playback rate), then starts the transport — the deferred
 * start the musician counts on. Pressing play again during the count abandons
 * it (still paused); pausing, a muted/soloed-away click, or no tempo at all
 * bypass the count entirely. Replacing or resetting the tempo (new detection,
 * fresh track, project open) abandons a pending count — its premise is gone.
 */
export function useCountIn(params: CountInParams): CountInTransport {
  const player = useMemo(
    () => params.player ?? createCountInPlayer(),
    [params.player]
  )
  const [countingIn, setCountingIn] = useState(false)
  // The pending count-in's cancel; also the "is one pending" flag the toggle
  // reads synchronously (state alone would lag a render behind).
  const cancelRef = useRef<(() => void) | undefined>(undefined)
  // The scheduled end fires async — always start the CURRENT transport.
  const toggleRef = useRef(params.togglePlayback)
  toggleRef.current = params.togglePlayback

  function abandon(): void {
    cancelRef.current?.()
    cancelRef.current = undefined
    setCountingIn(false)
  }

  /** The count-in a start would play right now, or undefined to start plain. */
  function pendingCountIn(): CountIn | undefined {
    const { analysis, canPlay, metronomeEnabled, mixerState } = params
    if (!canPlay || !metronomeEnabled || analysis === undefined) {
      return undefined
    }
    const click = effectiveGains(mixerState).find(
      (channel) => channel.id === METRONOME_ID
    )
    if (click === undefined || click.gain <= 0) {
      return undefined
    }
    const bpm =
      tempoAt(buildTempoMap(analysis.grid), params.positionSeconds) ??
      analysis.bpm
    return buildCountIn(bpm, analysis.beatsPerBar, params.timeRatio)
  }

  function togglePlayback(): void {
    // A press during the count is a change of mind: abandon it, stay paused.
    if (cancelRef.current !== undefined) {
      abandon()
      return
    }
    if (params.isPlaying) {
      params.togglePlayback()
      return
    }
    const countIn = pendingCountIn()
    if (countIn === undefined) {
      params.togglePlayback()
      return
    }
    cancelRef.current = player.play(countIn, () => {
      cancelRef.current = undefined
      setCountingIn(false)
      toggleRef.current()
    })
    setCountingIn(true)
  }

  // A replaced/reset tempo (fresh track, new detection, project open) pulls the
  // premise out from under a pending count — abandon it. Also covers unmount.
  const { analysis } = params
  useEffect(() => {
    // The analysis is the premise, not an input — read it so the dependency is
    // honest; the work happens in the cleanup, on the NEXT analysis (or unmount).
    void analysis
    return () => {
      cancelRef.current?.()
      cancelRef.current = undefined
      setCountingIn(false)
    }
  }, [analysis])

  return { countingIn, togglePlayback }
}
