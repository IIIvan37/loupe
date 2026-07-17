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

/**
 * Every occurrence of a section is a noisy observation of the same bars:
 * per position, the most frequent value wins; a tie keeps the representative
 * (first occurrence) — so grouping cleans the chart, not just the layout.
 * Generic on the cell value: chord labels and bar meters ride the same vote.
 */
export function votedBlock<T>(
  occurrences: readonly (readonly (T | undefined)[])[]
): readonly (T | undefined)[] {
  const representative = occurrences[0] as readonly (T | undefined)[]
  return representative.map((value, position) => {
    const counts = new Map<T | undefined, number>()
    for (const block of occurrences) {
      counts.set(block[position], (counts.get(block[position]) ?? 0) + 1)
    }
    let winner = value
    // The representative's own value is always counted, so its tally exists.
    let best = counts.get(value) ?? 0
    for (const [candidate, count] of counts) {
      if (count > best) {
        winner = candidate
        best = count
      }
    }
    return winner
  })
}

export interface EndingVariants {
  /** The shared opening bars, voted across the passes. */
  readonly body: MeasureLabels
  /** Each pass's own closing bars, in play order — volta 1, volta 2, … */
  readonly endings: readonly MeasureLabels[]
}

/**
 * Split same-section passes into a shared body and per-pass endings — the
 * split a volta bracket prints. A disputed bar in the BODY is detector noise
 * exactly when a strict majority of passes agrees there (the vote cleans it);
 * with no majority the passes genuinely diverge and there is no variant
 * split. A disputed bar in the ending zone IS the variation — the endings
 * start at the first disputed tail bar, each pass keeping its own bars there
 * (averaging them away is the whole failure the volta exists to avoid).
 */
export function endingVariants(
  occurrences: readonly MeasureLabels[]
): EndingVariants | undefined {
  const [first, ...rest] = occurrences
  if (first === undefined || rest.length === 0) return undefined
  if (rest.some((other) => other.length !== first.length)) return undefined
  const tailStart = first.length - TAIL_LENGTH
  let split = first.length
  for (let position = 0; position < first.length; position += 1) {
    if (!disputed(occurrences, position)) continue
    if (position < tailStart) {
      if (!hasStrictMajority(occurrences, position)) return undefined
    } else {
      split = Math.min(split, position)
    }
  }
  if (split === first.length) return undefined
  return {
    body: votedBlock(occurrences.map((pass) => pass.slice(0, split))),
    endings: occurrences.map((pass) => pass.slice(split))
  }
}

/** A position's evidence key: the downbeat chord, or silence. */
function evidenceKey(cell: string | undefined): string | undefined {
  return cell === undefined ? undefined : headChord(cell)
}

/** Whether the passes disagree at a position (silence vs a chord counts). */
function disputed(
  occurrences: readonly MeasureLabels[],
  position: number
): boolean {
  const keys = new Set(occurrences.map((pass) => evidenceKey(pass[position])))
  return keys.size > 1
}

/** Whether one reading owns MORE than half the passes at a position. */
function hasStrictMajority(
  occurrences: readonly MeasureLabels[],
  position: number
): boolean {
  const counts = new Map<string | undefined, number>()
  for (const pass of occurrences) {
    const key = evidenceKey(pass[position])
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return Math.max(...counts.values()) * 2 > occurrences.length
}
