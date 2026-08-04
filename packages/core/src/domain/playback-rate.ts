import {
  type Percent,
  percent,
  type Ratio,
  ratio,
  ratioToPercent
} from '../shared/units.ts'

/**
 * Playback tempo as a ratio of the original speed (1 = normal). Independent of
 * pitch — the time-stretch engine changes duration without transposing. The
 * range matches the transport's tempo control (40 %–150 %): the old 50 % floor
 * was too high for fine transcription work, and 25 % was judged too degraded
 * by ear (SoundTouch artefacts) — 40 % is the validated compromise.
 */
export const MIN_PLAYBACK_RATE = ratio(0.4)
export const MAX_PLAYBACK_RATE = ratio(1.5)

/**
 * The same bounds in the tempo controls' grain — integer percent of the
 * original speed (100 = normal). One derivation, shared by the transport
 * slider, the speed-trainer form and the ramp's own clamp, so the playable
 * range can never drift between them.
 */
export const MIN_TEMPO_PERCENT = ratioToPercent(MIN_PLAYBACK_RATE)
export const MAX_TEMPO_PERCENT = ratioToPercent(MAX_PLAYBACK_RATE)

/** Confine a tempo ratio to the supported range; `NaN` falls back to normal. */
export function clampPlaybackRate(rate: number): Ratio {
  if (Number.isNaN(rate)) {
    return ratio(1)
  }
  if (rate < MIN_PLAYBACK_RATE) {
    return MIN_PLAYBACK_RATE
  }
  if (rate > MAX_PLAYBACK_RATE) {
    return MAX_PLAYBACK_RATE
  }
  return ratio(rate)
}

/**
 * How much one keyboard/button step moves the tempo (AL.3) — coarse enough to
 * be felt, fine enough to home in on a target speed.
 */
export const TEMPO_PERCENT_STEP = 5

/**
 * Nudge a tempo read-out one step in `direction` (−1 slower, +1 faster),
 * clamped to the playable range. Rounds first so a fractional slider position
 * lands on a whole percent. Shared by the pill's ± buttons and the `[`/`]`
 * shortcuts, so both move by exactly the same grain.
 */
export function stepTempoPercent(value: number, direction: -1 | 1): Percent {
  const next = Math.round(value) + direction * TEMPO_PERCENT_STEP
  if (next < MIN_TEMPO_PERCENT) {
    return MIN_TEMPO_PERCENT
  }
  if (next > MAX_TEMPO_PERCENT) {
    return MAX_TEMPO_PERCENT
  }
  return percent(next)
}
