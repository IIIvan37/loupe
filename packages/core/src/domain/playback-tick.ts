import {
  type LoopRegion,
  loopLength,
  wrapToLoop
} from '../loops/domain/loop-region.ts'
import type { Seconds } from '../shared/units.ts'
import { completesLoopPass } from './speed-trainer.ts'

/**
 * The per-frame playback policy: what one streamed position means for the
 * transport. Engines tick at animation-frame rate OUTSIDE the reducer (the
 * playhead is not React state — Lot L.1), so the decision the position
 * listener executes lives here as values in, values out: wrap an armed loop,
 * or advance and stop at the end of a real timeline.
 */
export interface PlaybackTickInput {
  /** The streamed position, straight from the engine — parsed to `Seconds`
   * at the adapter boundary, the proof it is timeline time and not one of the
   * app's 0…1 progress ratios. */
  readonly atSeconds: Seconds
  /** The armed A/B loop — the loupe — when one is set. */
  readonly loop: LoopRegion | undefined
  /** Whether the loupe actually wraps playback (vs playing through). */
  readonly loopEnabled: boolean
  readonly isPlaying: boolean
  readonly durationSeconds: number
}

export type PlaybackTickOutcome =
  | {
      /** Jump back to the loop start, on the live engine. */
      readonly kind: 'wrap'
      readonly toSeconds: number
      /** Whether this wrap is a played-through pass (speed-trainer step) —
       * a seek landing far past the end wraps the playhead but earns nothing. */
      readonly completesPass: boolean
    }
  | {
      /** Stream the position; when `endReached`, playback stops. */
      readonly kind: 'advance'
      readonly endReached: boolean
    }

export function resolvePlaybackTick(
  input: PlaybackTickInput
): PlaybackTickOutcome {
  const { atSeconds, loop, loopEnabled, isPlaying, durationSeconds } = input
  // A degenerate (zero-length) loop would wrap-seek every frame — ignore it.
  if (
    loop &&
    loopEnabled &&
    loopLength(loop) > 0 &&
    wrapToLoop(loop, atSeconds) !== atSeconds
  ) {
    return {
      kind: 'wrap',
      toSeconds: loop.startSeconds,
      completesPass: completesLoopPass(loop, atSeconds)
    }
  }
  // Reaching the end of a real timeline stops playback; an empty timeline
  // never reads as "ended", and a transport already paused stays untouched.
  return {
    kind: 'advance',
    endReached: isPlaying && durationSeconds > 0 && atSeconds >= durationSeconds
  }
}
