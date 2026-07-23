/**
 * The panel's roman-numeral preference (AN.5) — whether the sheet reads its
 * chords as degrees of the named key. A render setting like bars-per-row:
 * this browser's reading habit (localStorage), never chart data. Storage
 * failures (private mode, quota) silently fall back — a preference is never
 * worth an error.
 */
const KEY = 'loupe.chords.roman-numerals'

/** The stored choice, or undefined when absent or unusable. */
export function readStoredRomanNumerals(): boolean | undefined {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw === 'true') return true
    if (raw === 'false') return false
    return undefined
  } catch {
    return undefined
  }
}

export function storeRomanNumerals(on: boolean): void {
  try {
    localStorage.setItem(KEY, String(on))
  } catch {
    // Private mode / quota: the session keeps its mode, it just won't stick.
  }
}
