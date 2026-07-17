import {
  deduceInstances,
  deduceStructure,
  renderStructuredSource,
  type SectionInstance,
  segmentRows,
  timeLine,
  withRepeatBars
} from './chart-structure.ts'
import { renderChartSource } from './chord-chart.ts'
import { detectCycle } from './harmonic-cycle.ts'
import {
  endingVariants,
  matchesTolerantly,
  votedBlock
} from './section-matching.ts'

type MeasureLabels = readonly (string | undefined)[]
type Meters = readonly (number | undefined)[]

/**
 * What each typographic device costs the READER on top of the bars it saves —
 * the encoder minimizes written measures + navigation, never raw compression.
 * A plain repeat is one glance back; a pass count must be kept in mind; a
 * volta adds bracket-tracking; a D.C. is a page-top jump musicians hate, so
 * it must save a page's worth of bars to be worth writing.
 */
const NAVIGATION_COST = {
  write: 0,
  repeat: 1,
  count: 2,
  volta: 3,
  daCapo: 10,
  fine: 1
} as const

/** A rollout only reads better than repeat bars from three passes up: for a
    pair, `|: … :|` is the idiom every musician expects. */
const MIN_ROLLOUT = 3

export interface EncodedChart {
  /** The grid source text, `parseChart`-readable. */
  readonly source: string
  /** The whole-form pass count, when the song is N passes of one cycle. The
      caller prints it as a `{form: Nx}` head directive. */
  readonly rollout?: number
}

/**
 * Encode a detected song as the most READABLE grid: separate the form from
 * the rollout (one cycle + `{form: Nx}` when the song is N identical passes),
 * then pick repeats, pass counts, voltas or a D.C. by dynamic programming
 * over the section passes. Falls back to the flat structured render — byte
 * for byte — when the song shows no structure worth encoding.
 */
export function encodeChartSource(
  labels: MeasureLabels,
  meters: Meters | undefined,
  barsPerRow: number,
  initialMeter?: number
): EncodedChart {
  const rolled = cycleRollout(labels, meters, barsPerRow, initialMeter)
  if (rolled !== undefined) return rolled
  return { source: encodeBody(labels, meters, barsPerRow, initialMeter) }
}

/**
 * The rollout move: when the song is ≥3 full passes of one cycle (no intro,
 * no tail, no variant endings between passes), write the cycle ONCE and
 * report the pass count. Variant endings refuse the rollout — a volta inside
 * the encoded body says it better than averaging the last chorus away.
 */
function cycleRollout(
  labels: MeasureLabels,
  meters: Meters | undefined,
  barsPerRow: number,
  initialMeter?: number
): EncodedChart | undefined {
  const cycle = detectCycle(labels)
  if (cycle?.intro !== 0 || cycle.tail !== 0 || cycle.count < MIN_ROLLOUT) {
    return undefined
  }
  const copies = chunk(labels, cycle.period)
  const [first, ...rest] = copies as [MeasureLabels, ...MeasureLabels[]]
  if (!rest.every((copy) => matchesTolerantly(first, copy))) return undefined
  if (endingVariants(copies) !== undefined) return undefined
  const canonicalMeters =
    meters === undefined ? undefined : votedBlock(chunk(meters, cycle.period))
  // The rollout re-enters the cycle at its own head: a meter that does not
  // return by the end would silently re-time every later pass.
  if (canonicalMeters !== undefined) {
    const entry = canonicalMeters[0] ?? initialMeter
    const walk = segmentRows(first, canonicalMeters, entry, barsPerRow)
    if (walk.running !== entry) return undefined
  }
  const canonical = votedBlock(copies)
  return {
    source: encodeBody(canonical, canonicalMeters, barsPerRow, initialMeter),
    rollout: cycle.count
  }
}

/** Encode one linear body (a whole song, or one cycle of it). */
function encodeBody(
  labels: MeasureLabels,
  meters: Meters | undefined,
  barsPerRow: number,
  initialMeter?: number
): string {
  const { instances, structured } = deduceInstances(labels, meters)
  if (!structured) {
    return renderStructuredSource(
      deduceStructure(labels, meters),
      barsPerRow,
      initialMeter
    )
  }
  return encodeInstances(instances, barsPerRow, initialMeter)
}

/** One rendered move of the plan: a block of source rows and its accounting. */
interface RenderedBlock {
  readonly label: string
  /** A meter to restate before the block (its opening leaves the running). */
  readonly lead: number | undefined
  readonly text: string
  /** Measures the block WRITES (folds count their body once). */
  readonly written: number
  readonly exit: number | undefined
}

interface Plan {
  readonly cost: number
  readonly navigation: number
  readonly blocks: readonly RenderedBlock[]
  readonly exit: number | undefined
}

/**
 * Dynamic programming over the section passes: at each pass, either write it,
 * fold a run of identical passes into `|: :|` (a pair) or `|: :| xN`, or
 * bracket a run's variant endings as voltas. A final D.C. candidate replays a
 * written prefix instead of writing the trailing passes again. Deterministic:
 * candidates are tried in a fixed order and only a strictly better cost wins.
 */
function encodeInstances(
  instances: readonly SectionInstance[],
  barsPerRow: number,
  initialMeter?: number
): string {
  const dp = planner(instances, barsPerRow)
  let best = dp(0, instances.length, initialMeter)
  let daCapo: { readonly fine: number | undefined } | undefined
  for (let dcAt = 1; dcAt < instances.length; dcAt += 1) {
    const replayed = instances.length - dcAt
    if (replayed > dcAt) continue
    if (!sameRun(instances, 0, dcAt, replayed)) continue
    const prefix = dp(0, replayed, initialMeter)
    const middle = dp(replayed, dcAt, prefix.exit)
    const isWholeReplay = replayed === dcAt
    const cost =
      prefix.cost +
      (isWholeReplay ? 0 : middle.cost) +
      NAVIGATION_COST.daCapo +
      (isWholeReplay ? 0 : NAVIGATION_COST.fine)
    if (cost < best.cost) {
      const blocks = isWholeReplay
        ? prefix.blocks
        : [...prefix.blocks, ...middle.blocks]
      best = { ...prefix, cost, blocks }
      daCapo = { fine: isWholeReplay ? undefined : prefix.blocks.length }
    }
  }
  return renderPlan(best.blocks, daCapo?.fine, daCapo !== undefined)
}

/** Whether the last `length` instances replay the first `length` ones —
    same types in the same order (types share their voted content). */
function sameRun(
  instances: readonly SectionInstance[],
  from: number,
  suffixStart: number,
  length: number
): boolean {
  for (let index = 0; index < length; index += 1) {
    if (
      instances[from + index]?.type !== instances[suffixStart + index]?.type
    ) {
      return false
    }
  }
  return true
}

/** The range planner: memoized best plan for instances `[from..to)` entering
    at a running meter. */
function planner(
  instances: readonly SectionInstance[],
  barsPerRow: number
): (from: number, to: number, running: number | undefined) => Plan {
  const memo = new Map<string, Plan>()
  // A type whose passes genuinely diverge at the end must print FAITHFULLY
  // (each pass its own bars) wherever it is not bracketed as a volta — the
  // voted copy would silently replace one pass's ending with another's.
  const faithfulTypes = new Set<number>()
  const rawsByType = new Map<number, MeasureLabels[]>()
  for (const instance of instances) {
    const raws = rawsByType.get(instance.type) ?? []
    raws.push(instance.raw)
    rawsByType.set(instance.type, raws)
  }
  for (const [type, raws] of rawsByType) {
    if (endingVariants(raws) !== undefined) faithfulTypes.add(type)
  }
  const dp = (from: number, to: number, running: number | undefined): Plan => {
    if (from >= to) {
      return { cost: 0, navigation: 0, blocks: [], exit: running }
    }
    const key = `${from}|${to}|${running ?? ''}`
    const cached = memo.get(key)
    if (cached !== undefined) return cached
    const head = instances[from] as SectionInstance
    let runLength = 1
    while (
      from + runLength < to &&
      instances[from + runLength]?.type === head.type
    ) {
      runLength += 1
    }
    const raws = instances
      .slice(from, from + runLength)
      .map((instance) => instance.raw)
    const variants = runLength > 1 ? endingVariants(raws) : undefined
    let best: Plan | undefined
    const consider = (
      consumed: number,
      block: RenderedBlock | undefined,
      navigation: number
    ): void => {
      if (block === undefined) return
      const tail = dp(from + consumed, to, block.exit)
      const cost = block.written + navigation + tail.cost
      const nav = navigation + tail.navigation
      if (
        best === undefined ||
        cost < best.cost ||
        (cost === best.cost && nav < best.navigation)
      ) {
        best = {
          cost,
          navigation: nav,
          blocks: [block, ...tail.blocks],
          exit: tail.exit
        }
      }
    }
    const faithful = faithfulTypes.has(head.type)
    // Longest folds first: on equal cost the earlier candidate is kept, and
    // a wider fold says more with the same ink. A faithful type's fold plays
    // the run's own (run-voted) bars, never the type's cross-run vote.
    for (let span = runLength; span >= 2; span -= 1) {
      const spanVariants =
        span === runLength ? variants : endingVariants(raws.slice(0, span))
      if (spanVariants !== undefined) continue
      const measures = faithful
        ? votedBlock(raws.slice(0, span))
        : head.measures
      consider(
        span,
        foldBlock(head, measures, span, running, barsPerRow),
        span === 2 ? NAVIGATION_COST.repeat : NAVIGATION_COST.count
      )
    }
    if (variants !== undefined) {
      consider(
        runLength,
        voltaBlock(head, variants, running, barsPerRow),
        NAVIGATION_COST.volta
      )
    }
    // Writing the whole run as plain copies is one block (today's layout);
    // writing just the head pass lets a later fold start mid-run.
    if (runLength > 1) {
      consider(
        runLength,
        writeBlock(
          instances.slice(from, from + runLength),
          faithful,
          running,
          barsPerRow
        ),
        NAVIGATION_COST.write
      )
    }
    consider(
      1,
      writeBlock([head], faithful, running, barsPerRow),
      NAVIGATION_COST.write
    )
    const chosen = best as Plan
    memo.set(key, chosen)
    return chosen
  }
  return dp
}

/** The meter a block must enter at, and the lead line that gets it there. */
function blockEntry(
  meters: Meters | undefined,
  running: number | undefined
): { readonly entry: number | undefined; readonly lead: number | undefined } {
  const opening = meters?.[0]
  const lead =
    opening !== undefined && running !== undefined && opening !== running
      ? opening
      : undefined
  return { entry: lead ?? running, lead }
}

/** Write a run as plain copies — today's layout, one block. A faithful type
    prints each pass's own bars; otherwise every copy prints the type's voted
    measures. */
function writeBlock(
  run: readonly SectionInstance[],
  faithful: boolean,
  running: number | undefined,
  barsPerRow: number
): RenderedBlock {
  const head = run[0] as SectionInstance
  const { entry, lead } = blockEntry(head.meters, running)
  const copies: string[] = []
  let written = 0
  let meter = entry
  for (const instance of run) {
    const measures = faithful ? instance.raw : instance.measures
    const rendered = segmentRows(measures, head.meters, meter, barsPerRow)
    copies.push(rendered.text)
    written += measures.length
    meter = rendered.running
  }
  return {
    label: head.label,
    lead,
    text: copies.join('\n'),
    written,
    exit: meter
  }
}

/** Fold `span` identical passes into `|: :|` (+ ` xN` beyond a pair). Only a
    pass-invariant render may fold: repeat bars cannot restate a meter. */
function foldBlock(
  instance: SectionInstance,
  measures: MeasureLabels,
  span: number,
  running: number | undefined,
  barsPerRow: number
): RenderedBlock | undefined {
  const { entry, lead } = blockEntry(instance.meters, running)
  const first = segmentRows(measures, instance.meters, entry, barsPerRow)
  if (!first.text.startsWith('|')) return undefined
  const second = segmentRows(
    measures,
    instance.meters,
    first.running,
    barsPerRow
  )
  if (second.text !== first.text) return undefined
  const suffix = span > 2 ? ` x${span}` : ''
  return {
    label: instance.label,
    lead,
    text: `${withRepeatBars(first.text)}${suffix}`,
    written: measures.length,
    exit: first.running
  }
}

/** Bracket a run's variant endings: `|: body |1. … :|` then one row per
    later ending. Voltas never thread a meter change — the bracket rows have
    no room for a `{time:}` line — so any in-block change refuses the move. */
function voltaBlock(
  instance: SectionInstance,
  variants: { body: MeasureLabels; endings: readonly MeasureLabels[] },
  running: number | undefined,
  barsPerRow: number
): RenderedBlock | undefined {
  const { entry, lead } = blockEntry(instance.meters, running)
  const steady =
    instance.meters === undefined ||
    instance.meters.every((meter) => meter === undefined || meter === entry)
  if (!steady || variants.body.length === 0) return undefined
  const body = withRepeatBars(renderChartSource(variants.body, barsPerRow))
  // withRepeatBars closes the body with :| — the repeat belongs to the FIRST
  // ending's row, so strip it back off the body.
  const openBody = `${body.slice(0, -2)}|`
  const rows = variants.endings.map((ending, index) => {
    const row = renderChartSource(ending, Math.max(ending.length, 1))
    const numbered = row.replace('| ', `|${index + 1}. `)
    const last = index === variants.endings.length - 1
    return last ? numbered : `${numbered.slice(0, -1)}:|`
  })
  const written =
    variants.body.length +
    variants.endings.reduce((total, ending) => total + ending.length, 0)
  return {
    label: instance.label,
    lead,
    text: [openBody, ...rows].join('\n'),
    written,
    exit: entry
  }
}

/** Print the plan: `{time:}` leads, `[label]` headers when there is more
    than one block, a `{fine}` line after the replayed prefix, and the
    closing `{d.c.}`. */
function renderPlan(
  blocks: readonly RenderedBlock[],
  fineAfter: number | undefined,
  daCapo: boolean
): string {
  const headed = blocks.length > 1
  const parts = blocks.map((block, index) => {
    const header = headed ? `[${block.label}]\n` : ''
    const lead = block.lead === undefined ? '' : `${timeLine(block.lead)}\n`
    const fine = fineAfter !== undefined && index === fineAfter - 1
    return `${lead}${header}${block.text}${fine ? '\n{fine}' : ''}`
  })
  return `${parts.join('\n\n')}${daCapo ? '\n{d.c.}' : ''}`
}

/** Cut a sequence into `size`-long pieces (the caller guarantees an exact
    fit). */
function chunk<T>(
  values: readonly T[],
  size: number
): readonly (readonly T[])[] {
  const pieces: (readonly T[])[] = []
  for (let start = 0; start < values.length; start += size) {
    pieces.push(values.slice(start, start + size))
  }
  return pieces
}
