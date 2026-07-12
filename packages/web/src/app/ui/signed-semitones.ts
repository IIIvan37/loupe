/**
 * Signed semitone read-out (+2 / -1 / 0) — one spelling for every surface
 * showing a key offset (transport pitch, chord-grid divergence hint), so the
 * same value never renders with two different glyphs on one screen.
 */
export function signedSemitones(value: number): string {
  return value > 0 ? `+${value}` : `${value}`
}
