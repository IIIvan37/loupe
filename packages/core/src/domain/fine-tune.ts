/**
 * Fine pitch adjustment in cents (hundredths of a semitone), SEPARATE from the
 * whole-semitone transposition: a recording 30 cents sharp (sped-up tape, old
 * pressings) needs the key nudged, not transposed. ±50 covers the whole gap to
 * the nearest semitone; beyond that the user wants the semitone slider. The
 * fine-tune never joins the chart's transposition arithmetic (N.3's modulo-12
 * divergence flag stays in whole semitones).
 */
export const MIN_FINE_TUNE_CENTS = -50
export const MAX_FINE_TUNE_CENTS = 50

/**
 * Confine a fine-tune to a whole number of cents within ±50; `NaN` falls back
 * to no adjustment (same contract as `clampPitchSemitones`).
 */
export function clampFineTuneCents(cents: number): number {
  if (Number.isNaN(cents)) {
    return 0
  }
  const whole = Math.round(cents)
  if (whole < MIN_FINE_TUNE_CENTS) {
    return MIN_FINE_TUNE_CENTS
  }
  if (whole > MAX_FINE_TUNE_CENTS) {
    return MAX_FINE_TUNE_CENTS
  }
  return whole
}
