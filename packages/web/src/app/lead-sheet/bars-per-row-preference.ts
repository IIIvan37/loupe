/**
 * The panel's layout preference — how many bars to a row. A render setting,
 * not chart data: it belongs to this browser (localStorage), never to the
 * project manifest, so every project opens with the layout the user reads
 * best. This module owns the whole rule — bounds, default, validity — so a
 * stored value a caller reads is always usable. Storage failures (private
 * mode, quota) silently fall back to the default — a preference is never
 * worth an error.
 */
const KEY = 'loupe.chords.bars-per-row'

/** The lead-sheet's default layout: four bars to a row, the lead-sheet norm. */
export const DEFAULT_BARS_PER_ROW = 4
/** The layout bounds — beyond them the sheet stops reading as a grid. */
export const MIN_BARS_PER_ROW = 1
export const MAX_BARS_PER_ROW = 12

export function isValidBarsPerRow(bars: number): boolean {
  return (
    Number.isInteger(bars) &&
    bars >= MIN_BARS_PER_ROW &&
    bars <= MAX_BARS_PER_ROW
  )
}

/** The stored preference, or undefined when absent or unusable (an out-of-
 * range or corrupt value never reaches a caller). */
export function readStoredBarsPerRow(): number | undefined {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw === null) {
      return undefined
    }
    const bars = Number(raw)
    return isValidBarsPerRow(bars) ? bars : undefined
  } catch {
    return undefined
  }
}

export function storeBarsPerRow(bars: number): void {
  try {
    localStorage.setItem(KEY, String(bars))
  } catch {
    // Private mode / quota: the session keeps its layout, it just won't stick.
  }
}
