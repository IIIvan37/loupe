import {
  type ChordChart,
  type Measure,
  type MeterChange,
  measureOfLabel,
  type Section
} from '../../harmony/domain/chord-chart.ts'
import { detectCycle } from '../../harmony/domain/harmonic-cycle.ts'
import {
  type EndingVariants,
  endingVariants,
  matchesTolerantly,
  votedBlock
} from '../../shared/section-matching.ts'
import {
  deduceInstances,
  deduceStructure,
  type SectionInstance,
  sameChanges,
  segmentMeasures,
  structuredChart,
  timeSignature
} from './chart-structure.ts'

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

/**
 * Encode a detected song as the most READABLE chart MODEL — `renderChart`
 * prints it: separate the form from the rollout (one cycle + a `{form: Nx}`
 * directive when the song is N identical passes), then pick repeats, pass
 * counts, voltas or a D.C. by dynamic programming over the section passes.
 * Falls back to the flat structured chart when the song shows no structure
 * worth encoding.
 */
export function encodeChart(
  labels: MeasureLabels,
  meters: Meters | undefined,
  initialMeter?: number
): ChordChart {
  const rolled = cycleRollout(labels, meters, initialMeter)
  if (rolled !== undefined) return rolled
  return encodeBody(labels, meters, initialMeter)
}

/**
 * The rollout move: when the song is ≥3 full passes of one cycle (no intro,
 * no tail, no variant endings between passes), write the cycle ONCE under a
 * `{form: Nx}` directive — the model's own rollout notation (`unrollChart`
 * multiplies playback by it). Variant endings refuse the rollout — a volta
 * inside the encoded body says it better than averaging the last chorus away.
 */
function cycleRollout(
  labels: MeasureLabels,
  meters: Meters | undefined,
  initialMeter?: number
): ChordChart | undefined {
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
    const walk = segmentMeasures(first, canonicalMeters, entry)
    if (walk.running !== entry) return undefined
  }
  const canonical = votedBlock(copies)
  return {
    ...encodeBody(canonical, canonicalMeters, initialMeter),
    directives: { form: `${cycle.count}x` }
  }
}

/** Encode one linear body (a whole song, or one cycle of it). */
function encodeBody(
  labels: MeasureLabels,
  meters: Meters | undefined,
  initialMeter?: number
): ChordChart {
  const { instances, structured } = deduceInstances(labels, meters)
  if (!structured) {
    return structuredChart(deduceStructure(labels, meters), initialMeter)
  }
  return encodeInstances(instances, initialMeter)
}

/** One rendered move of the plan: a fragment of chart MODEL — measures with
    their repeat/volta flags, block-local `{time:}` changes — and its meter
    accounting. `renderPlan` assembles the fragments into one `ChordChart`;
    only `renderChart` prints. */
interface RenderedBlock {
  readonly label: string
  /** A meter to restate before the block (its opening leaves the running). */
  readonly lead: number | undefined
  /** The block's measures — folds count their body once. */
  readonly measures: readonly Measure[]
  /** The `{time:}` changes inside the block, positions LOCAL to the block. */
  readonly changes: readonly MeterChange[]
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
  initialMeter?: number
): ChordChart {
  const dp = planner(instances)
  let best = dp(0, instances.length, initialMeter)
  let daCapo: { readonly fine: number | undefined } | undefined
  for (let dcAt = 1; dcAt < instances.length; dcAt += 1) {
    const candidate = daCapoCandidate(instances, dp, dcAt, initialMeter)
    if (candidate !== undefined && candidate.plan.cost < best.cost) {
      best = candidate.plan
      daCapo = { fine: candidate.fine }
    }
  }
  return planChart(best.blocks, daCapo?.fine, daCapo !== undefined)
}

/** The D.C. plan ending the form at `dcAt`: legal when the trailing passes
    replay a written prefix, costed with the jump (and the fine when the
    replay must stop early). `undefined` when no replay exists there. */
function daCapoCandidate(
  instances: readonly SectionInstance[],
  dp: (from: number, to: number, running: number | undefined) => Plan,
  dcAt: number,
  initialMeter: number | undefined
): { readonly plan: Plan; readonly fine: number | undefined } | undefined {
  const replayed = instances.length - dcAt
  if (replayed > dcAt) return undefined
  if (!sameRun(instances, 0, dcAt, replayed)) return undefined
  const prefix = dp(0, replayed, initialMeter)
  const middle = dp(replayed, dcAt, prefix.exit)
  const isWholeReplay = replayed === dcAt
  const cost =
    prefix.cost +
    (isWholeReplay ? 0 : middle.cost) +
    NAVIGATION_COST.daCapo +
    (isWholeReplay ? 0 : NAVIGATION_COST.fine)
  const blocks = isWholeReplay
    ? prefix.blocks
    : [...prefix.blocks, ...middle.blocks]
  return {
    plan: { ...prefix, cost, blocks },
    fine: isWholeReplay ? undefined : prefix.blocks.length
  }
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
  instances: readonly SectionInstance[]
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
  // A type prints FAITHFULLY (each pass its own bars) whenever its passes are
  // not all byte-identical — whether they diverge only at the end (a volta) or
  // anywhere else. A 4-bar tiling of a 7-bar section produces passes that merely
  // match TOLERANTLY (≥75%); voting them into one copy would silently drop the
  // bars where they differ, and playback would no longer equal the detection.
  for (const [type, raws] of rawsByType) {
    if (!allIdentical(raws)) faithfulTypes.add(type)
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
    let best: Plan | undefined
    const moves = movesAt(
      instances,
      from,
      runLength,
      faithfulTypes.has(head.type),
      running
    )
    for (const move of moves) {
      if (move.block === undefined) continue
      const tail = dp(from + move.consumed, to, move.block.exit)
      const cost = move.block.measures.length + move.navigation + tail.cost
      const nav = move.navigation + tail.navigation
      if (
        best === undefined ||
        cost < best.cost ||
        (cost === best.cost && nav < best.navigation)
      ) {
        best = {
          cost,
          navigation: nav,
          blocks: [move.block, ...tail.blocks],
          exit: tail.exit
        }
      }
    }
    const chosen = best as Plan
    memo.set(key, chosen)
    return chosen
  }
  return dp
}

interface Move {
  readonly consumed: number
  readonly block: RenderedBlock | undefined
  readonly navigation: number
}

/**
 * The candidate moves at one position, in tie-break order (the first
 * strictly-cheapest candidate wins): longest folds first — on equal cost the
 * earlier candidate is kept, and a wider fold says more with the same ink —
 * then the volta bracket, then plain copies (whole run as one block, today's
 * layout, or just the head pass so a later fold can start mid-run). A
 * faithful type's fold plays the run's own (run-voted) bars, never the
 * type's cross-run vote.
 */
function movesAt(
  instances: readonly SectionInstance[],
  from: number,
  runLength: number,
  faithful: boolean,
  running: number | undefined
): readonly Move[] {
  const head = instances[from] as SectionInstance
  const raws = instances
    .slice(from, from + runLength)
    .map((instance) => instance.raw)
  const variants = runLength > 1 ? endingVariants(raws) : undefined
  const moves: Move[] = []
  for (let span = runLength; span >= 2; span -= 1) {
    const spanRaws = raws.slice(0, span)
    const spanVariants =
      span === runLength ? variants : endingVariants(spanRaws)
    if (spanVariants !== undefined) continue
    // Repeat bars (`|: :|`, `xN`) replay ONE copy verbatim, so a fold is only
    // playback-correct when every folded pass is byte-identical — never on
    // tolerant near-matches (their differing bars would vanish).
    if (!allIdentical(spanRaws)) continue
    const measures = spanRaws[0] as MeasureLabels
    moves.push({
      consumed: span,
      block: foldBlock(head, measures, span, running),
      navigation: span === 2 ? NAVIGATION_COST.repeat : NAVIGATION_COST.count
    })
  }
  if (variants !== undefined) {
    moves.push({
      consumed: runLength,
      block: voltaBlock(head, variants, running),
      navigation: NAVIGATION_COST.volta
    })
  }
  if (runLength > 1) {
    moves.push({
      consumed: runLength,
      block: writeBlock(
        instances.slice(from, from + runLength),
        faithful,
        running
      ),
      navigation: NAVIGATION_COST.write
    })
  }
  moves.push({
    consumed: 1,
    block: writeBlock([head], faithful, running),
    navigation: NAVIGATION_COST.write
  })
  return moves
}

/** The meter a block must enter at, and the lead change that gets it there. */
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

/** Write a run as plain copies — the copies' measures chained into one
    block. A faithful type prints each pass's own bars; otherwise every copy
    prints the type's voted measures. */
function writeBlock(
  run: readonly SectionInstance[],
  faithful: boolean,
  running: number | undefined
): RenderedBlock {
  const head = run[0] as SectionInstance
  const { entry, lead } = blockEntry(head.meters, running)
  const measures: Measure[] = []
  const changes: MeterChange[] = []
  let meter = entry
  for (const instance of run) {
    const labels = faithful ? instance.raw : instance.measures
    const segment = segmentMeasures(labels, head.meters, meter)
    changes.push(
      ...segment.changes.map((change) => ({
        ...change,
        measure: measures.length + change.measure
      }))
    )
    measures.push(...segment.measures)
    meter = segment.running
  }
  return { label: head.label, lead, measures, changes, exit: meter }
}

/** Fold `span` identical passes into `|: :|` flags (+ a pass count beyond a
    pair). Only a pass-invariant walk may fold: repeat bars cannot restate a
    meter, so a second pass implying different `{time:}` changes refuses. */
function foldBlock(
  instance: SectionInstance,
  labels: MeasureLabels,
  span: number,
  running: number | undefined
): RenderedBlock | undefined {
  const { entry, lead } = blockEntry(instance.meters, running)
  const first = segmentMeasures(labels, instance.meters, entry)
  if (first.measures.length === 0) return undefined
  const second = segmentMeasures(labels, instance.meters, first.running)
  if (!sameChanges(first.changes, second.changes)) return undefined
  const measures = [...first.measures]
  measures[0] = { ...(measures[0] as Measure), repeatStart: true }
  measures[measures.length - 1] = {
    ...(measures.at(-1) as Measure),
    repeatEnd: true,
    ...(span > 2 && { repeatCount: span })
  }
  return {
    label: instance.label,
    lead,
    measures,
    changes: first.changes,
    exit: first.running
  }
}

/** Bracket a run's variant endings: the body opens `|:`, each ending wears
    its volta number and every non-final one closes `:|`. Voltas never thread
    a meter change — the bracket rows have no room for a `{time:}` line — so
    any in-block change refuses the move. */
function voltaBlock(
  instance: SectionInstance,
  variants: EndingVariants,
  running: number | undefined
): RenderedBlock | undefined {
  const { entry, lead } = blockEntry(instance.meters, running)
  const steady =
    instance.meters === undefined ||
    instance.meters.every((meter) => meter === undefined || meter === entry)
  if (!steady || variants.body.length === 0) return undefined
  const measures = variants.body.map(measureOfLabel)
  measures[0] = { ...(measures[0] as Measure), repeatStart: true }
  variants.endings.forEach((ending, index) => {
    measures.push(
      ...ending.map((label) => ({ ...measureOfLabel(label), volta: index + 1 }))
    )
    // Every ending but the last jumps back: its final bar closes with :|.
    if (index < variants.endings.length - 1) {
      measures[measures.length - 1] = {
        ...(measures.at(-1) as Measure),
        repeatEnd: true
      }
    }
  })
  return { label: instance.label, lead, measures, changes: [], exit: entry }
}

/** Assemble the plan's fragments into ONE chart model — leads and block
    changes offset into chart-global `MeterChange`s, `[label]` headers when
    there is more than one block, the fine and the closing D.C. as its
    `ChartForm`. Only `renderChart` prints. */
function planChart(
  blocks: readonly RenderedBlock[],
  fineAfter: number | undefined,
  daCapo: boolean
): ChordChart {
  const headed = blocks.length > 1
  const sections: Section[] = []
  const meterChanges: MeterChange[] = []
  let written = 0
  let fine: number | undefined
  blocks.forEach((block, index) => {
    if (block.lead !== undefined) {
      meterChanges.push({
        measure: written,
        signature: timeSignature(block.lead)
      })
    }
    meterChanges.push(
      ...block.changes.map((change) => ({
        ...change,
        measure: written + change.measure
      }))
    )
    sections.push({
      ...(headed && { label: block.label }),
      measures: block.measures
    })
    written += block.measures.length
    if (fineAfter !== undefined && index === fineAfter - 1) fine = written
  })
  return {
    sections,
    directives: {},
    ...(meterChanges.length > 0 && { meterChanges }),
    ...(daCapo && {
      form: { dc: written, ...(fine !== undefined && { fine }) }
    })
  }
}

/** Whether every block is byte-identical to the first — the only condition
    under which voting or a repeat fold preserves exact playback. */
function allIdentical(blocks: readonly MeasureLabels[]): boolean {
  const first = blocks[0]
  if (first === undefined) return true
  return blocks.every(
    (block) =>
      block.length === first.length &&
      block.every((label, index) => label === first[index])
  )
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
