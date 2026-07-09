/**
 * Playback tempo as a ratio of the original speed (1 = normal). Independent of
 * pitch — the time-stretch engine changes duration without transposing. The
 * range matches the transport's tempo control (25 %–150 %): SoundTouch keeps
 * stretching below half speed (artefacts grow, but slow enough for fine
 * transcription work — the old 50 % floor was the speed-trainer lot's blocker).
 */
export const MIN_PLAYBACK_RATE = 0.25
export const MAX_PLAYBACK_RATE = 1.5

/**
 * The same bounds in the tempo controls' grain — integer percent of the
 * original speed (100 = normal). One derivation, shared by the transport
 * slider, the speed-trainer form and the ramp's own clamp, so the playable
 * range can never drift between them.
 */
export const MIN_TEMPO_PERCENT = MIN_PLAYBACK_RATE * 100
export const MAX_TEMPO_PERCENT = MAX_PLAYBACK_RATE * 100

/** Confine a tempo ratio to the supported range; `NaN` falls back to normal. */
export function clampPlaybackRate(rate: number): number {
  if (Number.isNaN(rate)) {
    return 1
  }
  if (rate < MIN_PLAYBACK_RATE) {
    return MIN_PLAYBACK_RATE
  }
  if (rate > MAX_PLAYBACK_RATE) {
    return MAX_PLAYBACK_RATE
  }
  return rate
}
