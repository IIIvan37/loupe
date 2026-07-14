import type { BeatGrid } from './tempo.ts'

/**
 * One stretch of detected harmony: a chord token (in the grid's own spelling,
 * e.g. `Am`, `F#m7`) held over `[startSeconds, endSeconds)`. An absent label is
 * detected silence / no-chord — the adapter translates whatever the engine
 * emits into this shape, so the core never sees engine-specific syntax.
 */
export interface DetectedChordSpan {
  readonly startSeconds: number
  readonly endSeconds: number
  readonly label: string | undefined
}

/**
 * Fold timestamped chord spans into one CELL per measure — the beat-sync the
 * detection engines don't provide. The i-th measure is the grid's i-th
 * downbeat→downbeat interval (the same projection `measureIndexAt` plays back),
 * the last downbeat's bar extending by the previous bar's length (or to the end
 * of the detection when the grid holds a single downbeat). Within a bar the
 * labels vote weighted by held duration — so a change mid-bar lands on the
 * downbeat of the bar it dominates — and a bar mostly uncovered by any label
 * stays blank (`undefined`) rather than inheriting a passing chord. A bar whose
 * two halves are each dominated by a DIFFERENT chord prints both (`'C G'`, the
 * two-chord bar of a lead sheet), split at its middle beat.
 */
export function chordLabelPerMeasure(
  spans: readonly DetectedChordSpan[],
  grid: BeatGrid
): readonly (string | undefined)[] {
  const downbeats = grid
    .filter((beat) => beat.downbeat)
    .map((beat) => beat.timeSeconds)
  const first = downbeats[0]
  if (first === undefined) {
    return []
  }
  // No spans reduce to a zero horizon, so they fall under the same guard: a
  // detection that never reaches past the first downbeat has no bar to fill.
  const horizon = spans.reduce((end, span) => Math.max(end, span.endSeconds), 0)
  if (horizon <= first) {
    return []
  }
  const last = downbeats[downbeats.length - 1] as number
  const secondToLast = downbeats[downbeats.length - 2]
  const lastBarEnd =
    secondToLast === undefined ? horizon : last + (last - secondToLast)
  return downbeats.map((barStart, index) =>
    cellLabel(spans, grid, barStart, downbeats[index + 1] ?? lastBarEnd)
  )
}

/**
 * The cell a bar prints: its dominant label — split in two when each half is
 * dominated by a different chord, the genuine mid-bar change of a two-chord
 * bar. The split sits on the bar's middle BEAT (the felt halfway, robust to
 * intra-bar tempo drift; 2+1 in a three-beat bar), falling back to the time
 * midpoint when the grid holds too few beats to name one. A half that no
 * chord dominates (silence, jitter) vetoes the split — a phantom `'C _'`
 * change would be worse than the whole-bar vote.
 */
function cellLabel(
  spans: readonly DetectedChordSpan[],
  grid: BeatGrid,
  barStart: number,
  barEnd: number
): string | undefined {
  const beats = grid.filter(
    (beat) => beat.timeSeconds >= barStart && beat.timeSeconds < barEnd
  )
  const mid =
    beats[Math.round(beats.length / 2)]?.timeSeconds ?? (barStart + barEnd) / 2
  const head = dominantLabel(spans, barStart, mid)
  const tail = dominantLabel(spans, mid, barEnd)
  // The join's space is load-bearing grammar downstream (one token per
  // chord): a multi-word engine label must not fabricate extra chords, so
  // such a bar keeps its whole-bar vote.
  const splits =
    head !== undefined &&
    tail !== undefined &&
    head !== tail &&
    !/\s/.test(head + tail)
  return splits ? `${head} ${tail}` : dominantLabel(spans, barStart, barEnd)
}

/** The label holding `[barStart, barEnd)` longest — or none when silence wins. */
function dominantLabel(
  spans: readonly DetectedChordSpan[],
  barStart: number,
  barEnd: number
): string | undefined {
  const held = new Map<string, number>()
  let covered = 0
  for (const span of spans) {
    if (span.label === undefined) continue
    const overlap =
      Math.min(span.endSeconds, barEnd) - Math.max(span.startSeconds, barStart)
    if (overlap > 0) {
      held.set(span.label, (held.get(span.label) ?? 0) + overlap)
      covered += overlap
    }
  }
  let winner: string | undefined
  let longest = 0
  for (const [label, duration] of held) {
    if (duration > longest) {
      winner = label
      longest = duration
    }
  }
  const silence = barEnd - barStart - covered
  return longest >= silence ? winner : undefined
}
