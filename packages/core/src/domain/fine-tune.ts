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
 * Confine a fine-tune to a whole number of cents within ±50; `NaN` — or a
 * non-number smuggled in by a hand-edited manifest — falls back to no
 * adjustment (same contract as `clampPitchSemitones`).
 */
/**
 * Normalise the optional persisted fine-tune of a project tuning: a manifest
 * (or tuning) that predates the field means no adjustment, so absent reads as
 * 0 — the same « old manifest » rule as the project's
 * `tuningOrDefault`/`chartTransposedBy`, kept here so the re-clamp lives with
 * the clamp it applies (the tuning's other scalars re-clamp through
 * `clampPlaybackRate`/`clampPitchSemitones` the same way). A corrupted
 * (hand-edited) value reads as 0 through the clamp's NaN contract.
 */
export function fineTuneOrDefault(
  tuning: { readonly fineTuneCents?: number } | undefined
): number {
  return clampFineTuneCents(tuning?.fineTuneCents ?? 0)
}

export function clampFineTuneCents(cents: number): number {
  if (typeof cents !== 'number' || Number.isNaN(cents)) {
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
