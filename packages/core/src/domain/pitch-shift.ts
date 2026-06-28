/**
 * Pitch transposition in whole semitones (0 = original key), independent of
 * tempo. The range matches the transport's pitch control (±12 = one octave).
 */
export const MIN_PITCH_SEMITONES = -12
export const MAX_PITCH_SEMITONES = 12

/**
 * Confine a pitch shift to a whole number of semitones within range; `NaN` falls
 * back to no shift.
 */
export function clampPitchSemitones(semitones: number): number {
  if (Number.isNaN(semitones)) {
    return 0
  }
  const whole = Math.round(semitones)
  if (whole < MIN_PITCH_SEMITONES) {
    return MIN_PITCH_SEMITONES
  }
  if (whole > MAX_PITCH_SEMITONES) {
    return MAX_PITCH_SEMITONES
  }
  return whole
}
