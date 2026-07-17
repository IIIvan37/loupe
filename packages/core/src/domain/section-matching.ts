type MeasureLabels = readonly (string | undefined)[]

/** How many closing bars count as a block's ending zone — the turnaround the
    volta brackets print. Two, like a printed two-bar ending. */
const TAIL_LENGTH = 2

/** An ending-zone difference weighs half a body one: two passes diverging
    only at the end are the same section with different endings — the exact
    case that produces a volta 1/2 — while a different opening is simply a
    different section. */
const TAIL_WEIGHT = 0.5

/** Two blocks are the same section when their weighted agreement reaches this
    share of the weighted detected evidence. */
const MATCH_RATIO = 0.75

export interface BlockSimilarity {
  /** Weighted agreement over weighted detected evidence, in [0, 1]. Evidence
      of nothing (two all-silent blocks) disproves nothing: ratio 1. */
  readonly ratio: number
  /** The positions where the blocks genuinely differ (one-sided detection
      included — silence on one side only is a disagreement). */
  readonly differing: readonly number[]
  /** Whether every difference sits in the ending zone. */
  readonly tailOnly: boolean
}

/**
 * Position-weighted agreement between two equal-length blocks of per-measure
 * chord cells. Blank-vs-blank positions carry no evidence either way, and
 * agreement on the downbeat chord of a split cell (`'F G'` vs `'F'`) is
 * agreement — detection jitter, not music. The caller guarantees equal
 * lengths (`matchesTolerantly` refuses the comparison otherwise).
 */
export function blockSimilarity(
  a: MeasureLabels,
  b: MeasureLabels
): BlockSimilarity {
  const differing: number[] = []
  let evidence = 0
  let agreeing = 0
  a.forEach((label, index) => {
    const other = b[index]
    if (label === undefined && other === undefined) return
    const weight = index >= a.length - TAIL_LENGTH ? TAIL_WEIGHT : 1
    evidence += weight
    if (
      label !== undefined &&
      other !== undefined &&
      headChord(label) === headChord(other)
    ) {
      agreeing += weight
    } else {
      differing.push(index)
    }
  })
  return {
    ratio: evidence === 0 ? 1 : agreeing / evidence,
    differing,
    tailOnly: differing.every((index) => index >= a.length - TAIL_LENGTH)
  }
}

/** Whether two blocks read as the same section: equal length and weighted
    agreement at the match threshold. */
export function matchesTolerantly(a: MeasureLabels, b: MeasureLabels): boolean {
  return a.length === b.length && blockSimilarity(a, b).ratio >= MATCH_RATIO
}

/** A cell's head chord — the downbeat token of a possibly split cell. */
function headChord(cell: string): string {
  const space = cell.indexOf(' ')
  return space === -1 ? cell : cell.slice(0, space)
}
