import { parseChart, renderChartSource, unrollChart } from './chord-chart.ts'
import { formatChordSymbol } from './chord-symbol.ts'
import type { DetectedSection } from './song-structure.ts'
import { type BeatGrid, dominantMeter, meterPerMeasure } from './tempo.ts'

/**
 * One deduced block of the song: a run of measures the deduction groups under
 * a neutral letter label ('A', 'B', …). Re-occurrences of the same block share
 * the label AND the same (cleaned) measures.
 */
export interface DeducedSection {
  readonly label: string
  readonly measures: readonly (string | undefined)[]
  /** The per-measure meter (beats per bar) when the caller read one off the
      grid — voted like the measures; `undefined` inherits the running meter. */
  readonly meters?: Meters
}

type MeasureLabels = readonly (string | undefined)[]
type Meters = readonly (number | undefined)[]

/** A signature-change line: the standard `{time: N/M}` notation. The grid's
    beats are the ♩ pulse, so the denominator is always a quarter. The ONE
    place the notation is spelled — the draft head (detectChords) and the
    in-grid marks print through it, so the two can never drift. */
export function timeLine(meter: number): string {
  return `{time: ${meter}/4}`
}

/**
 * The meters a chart draft may print from a grid: the per-measure beat counts
 * and their dominant. Three policies keep detector noise off the chart:
 *
 * - The session's `beatsPerBar` is the authority when given — after an octave
 *   fold the grid's raw beat density doubles or halves while the felt meter
 *   does not, so every count rescales to the felt bar (a non-integer rescale
 *   is noise: no meter worth printing).
 * - Only complete bars elect the voted dominant (the trailing one runs to the
 *   track end) — the same electorate as `detectMeter`, so the chart head can
 *   never contradict the tempo panel.
 * - EDGE bars are distrusted unless they land on the dominant: the first
 *   interval is often a pickup, the last is usually truncation (a fade-out) —
 *   neither is a signature change. This also guarantees the render never
 *   opens with a bare `{time:}` lead that would collide with the draft's own
 *   head directive in `parseChart`'s head zone.
 */
export function chartMeters(
  grid: BeatGrid,
  beatsPerBar?: number
): {
  readonly meters: Meters
  readonly dominant: number
} {
  const counted = meterPerMeasure(grid)
  const complete = counted.slice(0, -1)
  const voted = dominantMeter(complete.length > 0 ? complete : counted)
  const dominant = beatsPerBar ?? voted
  const factor = dominant / voted
  const meters = counted.map((count, index) => {
    const meter = count * factor
    const interior = index > 0 && index < counted.length - 1
    return Number.isInteger(meter) &&
      meter >= 1 &&
      (interior || meter === dominant)
      ? meter
      : undefined
  })
  return { meters, dominant }
}

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
  labels: MeasureLabels,
  meters?: Meters
): readonly DeducedSection[] {
  // The whole song is itself the one-block tiling — a single cost formula
  // scores every candidate, so the baseline can never drift from the tilings.
  let best = tile(labels, meters, labels.length)
  for (const length of SECTION_LENGTHS) {
    const candidate = tile(labels, meters, length)
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
  barsPerRow: number,
  initialMeter?: number
): string {
  const runs = groupRuns(sections)
  let running = initialMeter
  return runs
    .map((run) => {
      const { measures, meters } = run.section
      // A change on the section's FIRST measure prints before the block (and
      // its header) — like a signature change at a section boundary — so a
      // repeat-folded block still starts on a bar line for the `|:` splice.
      const opening = meters?.[0]
      const lead =
        opening !== undefined && running !== undefined && opening !== running
          ? opening
          : undefined
      if (lead !== undefined) running = lead
      // Every copy walks segmentRows so a section ending off its opening
      // meter re-states it on the next written copy (memoized per entry
      // meter — identical copies render once). A pair folds into |: … :|
      // ONLY when both passes read identically: repeat bars cannot re-state
      // a meter, so a non-returning change forbids the fold.
      const memo = new Map<number | undefined, ReturnType<typeof segmentRows>>()
      const copies: string[] = []
      for (let copy = 0; copy < run.count; copy += 1) {
        let rendered = memo.get(running)
        if (rendered === undefined) {
          rendered = segmentRows(measures, meters, running, barsPerRow)
          memo.set(running, rendered)
        }
        copies.push(rendered.text)
        running = rendered.running
      }
      const body =
        run.count === 2 && copies[0] === copies[1]
          ? withRepeatBars(copies[0] as string)
          : copies.join('\n')
      const headed =
        runs.length === 1 ? body : `[${run.section.label}]\n${body}`
      return lead === undefined ? headed : `${timeLine(lead)}\n${headed}`
    })
    .join('\n\n')
}

/**
 * Render a section's measures as rows, splitting at meter changes: each
 * maximal same-meter stretch prints as its own rows behind a `{time: N/4}`
 * line. An unknown meter inherits the running one; with no known running meter
 * the first one seen is adopted silently (the head names it, not a change).
 */
function segmentRows(
  measures: MeasureLabels,
  meters: Meters | undefined,
  runningMeter: number | undefined,
  barsPerRow: number
): { readonly text: string; readonly running: number | undefined } {
  const parts: string[] = []
  let group: (string | undefined)[] = []
  let running = runningMeter
  measures.forEach((label, index) => {
    const meter = meters?.[index]
    if (meter !== undefined && meter !== running) {
      if (group.length > 0) {
        parts.push(renderChartSource(group, barsPerRow))
        group = []
      }
      if (running !== undefined) parts.push(timeLine(meter))
      running = meter
    }
    group.push(label)
  })
  if (group.length > 0) {
    parts.push(renderChartSource(group, barsPerRow))
  }
  return { text: parts.join('\n'), running }
}

/**
 * Relabel an existing grid by the detected structure: keep its chords, but cut
 * the measures at the detected section boundaries and head each block with that
 * section's label (`[Couplet]`, `[Refrain]`…). This is what « Détecter la
 * structure » does when a grid already exists — the neutral `[A]`/`[B]` the
 * repetition deduces gives way to the engine's named sections.
 *
 * The section labels are printed VERBATIM as headers: the caller supplies
 * display copy (the core keeps no display vocabulary — translating the engine's
 * raw `verse`/`chorus` is the adapter's job, exactly as for the markers).
 *
 * The grid is read as its PLAYED measures (`unrollChart`, so a `|: … :|` grid
 * stays aligned with the section times, which live in playback seconds), each
 * measure taken as its first chord — the flat one-token-per-measure model the
 * printer round-trips (a hand-edited multi-chord bar collapses to its first
 * chord; auto-drafts are one chord per bar). A blank grid, or a detection with
 * no section, has nothing to relabel and passes through untouched.
 */
export function relabelChartBySections(
  source: string,
  sections: readonly DetectedSection[],
  grid: BeatGrid,
  barsPerRow: number,
  beatsPerBar?: number
): string {
  const labels = playedLabels(source)
  if (labels.length === 0 || sections.length === 0) {
    return source
  }
  // The grid also knows each measure's length: re-mark the meter changes on
  // the relabelled chart, exactly as the detection draft does (the session's
  // beatsPerBar keeps a folded grid's density from reading as the meter).
  const { meters, dominant } = chartMeters(grid, beatsPerBar)
  return renderStructuredSource(
    cutBySections(labels, meters, sections, grid),
    barsPerRow,
    dominant
  )
}

/** A section's start on the timeline: the instant of the downbeat where its
    first measure first PLAYS, under the header's verbatim label. */
export interface SectionAnchor {
  readonly timeSeconds: number
  readonly label: string
}

/**
 * Derive the structure markers a chart implies: one anchor per labelled
 * `[Section]` header, at the downbeat where the section's first measure first
 * plays (`unrollChart` — a repeat before it shifts it, exactly the projection
 * playback highlighting uses). This is the chart-is-authority direction of the
 * marker sync: edit a header, and the timeline follows. Headers that anchor
 * nothing are skipped — an empty label, a header with no measures yet
 * (mid-typing), or a section the grid has no downbeat for — and a grid without
 * downbeats anchors nothing at all.
 */
export function chartSectionAnchors(
  source: string,
  grid: BeatGrid
): readonly SectionAnchor[] {
  const downbeats = grid
    .filter((beat) => beat.downbeat)
    .map((beat) => beat.timeSeconds)
  if (downbeats.length === 0) {
    return []
  }
  const chart = parseChart(source)
  const played = unrollChart(chart)
  const anchors: SectionAnchor[] = []
  let written = 0
  for (const section of chart.sections) {
    const start = written
    written += section.measures.length
    if ((section.label ?? '') === '' || section.measures.length === 0) {
      continue
    }
    const playedIndex = played.indexOf(start)
    if (playedIndex === -1 || playedIndex >= downbeats.length) {
      continue
    }
    anchors.push({
      timeSeconds: downbeats[playedIndex] as number,
      label: section.label as string
    })
  }
  return anchors
}

/** The grid's chords as one token per PLAYED measure — the chart unrolled so a
    repeat plays its bars twice, each bar reduced to its first chord. */
function playedLabels(source: string): MeasureLabels {
  const chart = parseChart(source)
  const measures = chart.sections.flatMap((section) => section.measures)
  return unrollChart(chart).map((index) => {
    const chord = measures[index]?.chords[0]
    return chord === undefined ? undefined : formatChordSymbol(chord)
  })
}

/** Slice the flat measure labels at the boundary each section falls on (the
    count of downbeats before its start time), one block per section, dropping a
    block a section beyond the grid leaves empty. Boundaries are clamped
    non-decreasing so the cut never inverts; the first section always opens at 0
    so no leading measure is lost. */
function cutBySections(
  labels: MeasureLabels,
  meters: Meters,
  sections: readonly DetectedSection[],
  grid: BeatGrid
): readonly DeducedSection[] {
  const downbeats = grid
    .filter((beat) => beat.downbeat)
    .map((beat) => beat.timeSeconds)
  // No downbeats means no way to place a section on a measure — one block over
  // the whole grid, under the first section's name, rather than a mis-cut.
  if (downbeats.length === 0) {
    return [{ label: (sections[0] as DetectedSection).label, measures: labels }]
  }
  let previous = 0
  const cuts = sections.map((section, index) => {
    const measure =
      index === 0
        ? 0
        : downbeats.filter((time) => time < section.startSeconds).length
    previous = Math.min(Math.max(measure, previous), labels.length)
    return previous
  })
  const result: DeducedSection[] = []
  sections.forEach((section, index) => {
    const start = cuts[index] as number
    const end =
      index + 1 < cuts.length ? (cuts[index + 1] as number) : labels.length
    if (end > start) {
      result.push({
        label: section.label,
        measures: labels.slice(start, end),
        meters: meters.slice(start, end)
      })
    }
  })
  return result
}

/** Consecutive plays of THE SAME section object (deduction shares one per
    type), folded to (section, count) — identity, not label, so a caller who
    reuses a label with different measures never loses the second content. */
function groupRuns(
  sections: readonly DeducedSection[]
): readonly { section: DeducedSection; count: number }[] {
  const runs: { section: DeducedSection; count: number }[] = []
  for (const section of sections) {
    const last = runs[runs.length - 1]
    if (last && last.section === section) {
      last.count += 1
    } else {
      runs.push({ section, count: 1 })
    }
  }
  return runs
}

/** Wrap rendered rows in `|: … :|` — the pair plays back as two passes. Every
    rendered block starts and ends with a bar line, so the repeat dots splice
    onto the string's own first and last characters, across all its rows. */
function withRepeatBars(rows: string): string {
  return `|:${rows.slice(1, -1)}:|`
}

/** Cut the song into `length`-bar blocks (plus a tail) and group equal blocks
    under one letter type; the cost is the MDL of that explanation. */
function tile(
  labels: MeasureLabels,
  meters: Meters | undefined,
  length: number
): { cost: number; sections: readonly DeducedSection[] } {
  const types: {
    blocks: [MeasureLabels, ...MeasureLabels[]]
    meterBlocks: Meters[]
  }[] = []
  const assignment: number[] = []
  for (let start = 0; start < labels.length; start += length) {
    const block = labels.slice(start, start + length)
    const meterBlock = meters?.slice(start, start + length)
    const match = types.find(({ blocks: [representative] }) =>
      matchesBlock(representative, block)
    )
    if (match === undefined) {
      assignment.push(types.length)
      types.push({
        blocks: [block],
        meterBlocks: meterBlock === undefined ? [] : [meterBlock]
      })
    } else {
      assignment.push(types.indexOf(match))
      match.blocks.push(block)
      if (meterBlock !== undefined) match.meterBlocks.push(meterBlock)
    }
  }
  // ONE section object per type: re-occurrences share it, so the renderer can
  // fold runs on object identity — the shared-measures invariant is structural.
  // Meters ride the same vote as the labels: every occurrence is a noisy
  // observation of the same bars, their lengths included.
  const sections = types.map((type, index) => ({
    label: sectionLabel(index),
    measures: votedBlock(type.blocks),
    ...(type.meterBlocks.length > 0 && {
      meters: votedBlock(type.meterBlocks)
    })
  }))
  return {
    cost:
      sections.reduce((total, type) => total + type.measures.length, 0) +
      assignment.length,
    sections: assignment.map((index) => sections[index] as DeducedSection)
  }
}

/** Neutral type labels: 'A'…'Z', then 'AA', 'AB', … — bijective base 26. */
function sectionLabel(index: number): string {
  const letter = String.fromCharCode(65 + (index % 26))
  const rest = Math.floor(index / 26)
  return rest === 0 ? letter : `${sectionLabel(rest - 1)}${letter}`
}

/**
 * Every occurrence of a section is a noisy observation of the same bars:
 * per position, the most frequent value wins; a tie keeps the representative
 * (first occurrence) — so grouping cleans the chart, not just the layout.
 * Generic on the cell value: chord labels and bar meters ride the same vote.
 */
function votedBlock<T>(
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

/** Detection is noisy: two blocks are the same section when at least 3/4 of
    their DETECTED bars agree — a tail block (shorter) never matches a full
    one. Silence carries no evidence: blank-vs-blank positions count for
    neither side, so mostly-silent blocks only merge on the chords they do
    share, never on shared emptiness outvoting a real difference. */
const MATCH_RATIO = 0.75

function matchesBlock(a: MeasureLabels, b: MeasureLabels): boolean {
  if (a.length !== b.length) return false
  let agreeing = 0
  let detected = 0
  a.forEach((label, index) => {
    const other = b[index]
    if (label === undefined && other === undefined) return
    detected += 1
    if (label === other) agreeing += 1
  })
  return agreeing >= detected * MATCH_RATIO
}
