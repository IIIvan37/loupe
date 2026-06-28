/**
 * Format a number of seconds as a `m:ss` timecode (e.g. `4:32`). Minutes are not
 * padded and grow past 59; seconds are always two digits. Negative or `NaN`
 * inputs read as `0:00`. Pure — the numeric font styling is the view's job.
 */
export function formatTimecode(seconds: number): string {
  const safe = Number.isNaN(seconds) || seconds < 0 ? 0 : seconds
  const whole = Math.floor(safe)
  const minutes = Math.floor(whole / 60)
  const remainder = whole % 60
  return `${minutes}:${remainder.toString().padStart(2, '0')}`
}
