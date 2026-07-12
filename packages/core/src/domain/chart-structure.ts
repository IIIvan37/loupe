import { renderChartSource } from './chord-chart.ts'

/**
 * One deduced block of the song: a run of measures the deduction groups under
 * a neutral letter label ('A', 'B', …). Re-occurrences of the same block share
 * the label AND the same (cleaned) measures.
 */
export interface DeducedSection {
  readonly label: string
  readonly measures: readonly (string | undefined)[]
}

type MeasureLabels = readonly (string | undefined)[]

/** Common section lengths in bars — the only tilings worth scoring. */
const SECTION_LENGTHS = [16, 12, 8, 4]

/**
 * Deduce the song's structure from the flat one-label-per-measure sequence, as
 * a compression problem: the whole song counts as one candidate explanation,
 * and each uniform tiling by a common section length is another. A candidate's
 * cost is the measures its DISTINCT blocks span plus one reference per block
 * (minimum description length) — repetition makes a tiling cheaper than the
 * flat song, so structure is chosen exactly when it explains something.
 */
export function deduceStructure(
  labels: MeasureLabels
): readonly DeducedSection[] {
  let best = {
    cost: labels.length + 1,
    sections: [{ label: 'A', measures: labels }] as readonly DeducedSection[]
  }
  for (const length of SECTION_LENGTHS) {
    if (length >= labels.length) continue
    const candidate = tile(labels, length)
    if (candidate.cost < best.cost) best = candidate
  }
  return best.sections
}

/**
 * Print deduced sections as grid source text `parseChart` reads back:
 * consecutive plays of the same section fold — a pair into `|: … :|` repeat
 * bars, a longer run into written copies — and each run gets its `[A]` header,
 * except when the whole song is one run (a header naming the only block says
 * nothing).
 */
export function renderStructuredSource(
  sections: readonly DeducedSection[],
  barsPerRow: number
): string {
  const runs = groupRuns(sections)
  return runs
    .map((run) => {
      const rows = renderChartSource(run.section.measures, barsPerRow)
      const body =
        run.count === 2
          ? withRepeatBars(rows)
          : Array.from({ length: run.count }, () => rows).join('\n')
      return runs.length === 1 ? body : `[${run.section.label}]\n${body}`
    })
    .join('\n\n')
}

/** Consecutive plays of the same section, folded to (section, count). */
function groupRuns(
  sections: readonly DeducedSection[]
): readonly { section: DeducedSection; count: number }[] {
  const runs: { section: DeducedSection; count: number }[] = []
  for (const section of sections) {
    const last = runs[runs.length - 1]
    if (last && last.section.label === section.label) {
      last.count += 1
    } else {
      runs.push({ section, count: 1 })
    }
  }
  return runs
}

/** Wrap rendered rows in `|: … :|` — the pair plays back as two passes. */
function withRepeatBars(rows: string): string {
  const lines = rows.split('\n')
  lines[0] = `|:${(lines[0] as string).slice(1)}`
  const lastIndex = lines.length - 1
  lines[lastIndex] = `${(lines[lastIndex] as string).slice(0, -1)}:|`
  return lines.join('\n')
}

/** Cut the song into `length`-bar blocks (plus a tail) and group equal blocks
    under one letter type; the cost is the MDL of that explanation. */
function tile(
  labels: MeasureLabels,
  length: number
): { cost: number; sections: readonly DeducedSection[] } {
  const types: MeasureLabels[][] = []
  const assignment: number[] = []
  for (let start = 0; start < labels.length; start += length) {
    const block = labels.slice(start, start + length)
    let index = types.findIndex(([representative]) =>
      matchesBlock(representative as MeasureLabels, block)
    )
    if (index === -1) {
      index = types.length
      types.push([])
    }
    ;(types[index] as MeasureLabels[]).push(block)
    assignment.push(index)
  }
  const cleaned = types.map((occurrences) => votedBlock(occurrences))
  return {
    cost:
      cleaned.reduce((total, type) => total + type.length, 0) +
      assignment.length,
    sections: assignment.map((index) => ({
      label: String.fromCharCode(65 + index),
      measures: cleaned[index] as MeasureLabels
    }))
  }
}

/**
 * Every occurrence of a section is a noisy observation of the same bars:
 * per position, the most frequent label wins; a tie keeps the representative
 * (first occurrence) — so grouping cleans the chart, not just the layout.
 */
function votedBlock(occurrences: readonly MeasureLabels[]): MeasureLabels {
  const representative = occurrences[0] as MeasureLabels
  return representative.map((label, position) => {
    const counts = new Map<string | undefined, number>()
    for (const block of occurrences) {
      counts.set(block[position], (counts.get(block[position]) ?? 0) + 1)
    }
    let winner = label
    let best = counts.get(label) ?? 0
    for (const [candidate, count] of counts) {
      if (count > best) {
        winner = candidate
        best = count
      }
    }
    return winner
  })
}

/** Detection is noisy: two blocks are the same section when at least 3/4 of
    their bars agree — a tail block (shorter) never matches a full one. */
const MATCH_RATIO = 0.75

function matchesBlock(a: MeasureLabels, b: MeasureLabels): boolean {
  if (a.length !== b.length) return false
  const agreeing = a.filter((label, index) => label === b[index]).length
  return agreeing >= a.length * MATCH_RATIO
}
