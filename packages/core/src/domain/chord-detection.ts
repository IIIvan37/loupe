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
 * Fold timestamped chord spans into one label per measure — the beat-sync the
 * detection engines don't provide. The i-th measure is the grid's i-th
 * downbeat→downbeat interval (the same projection `measureIndexAt` plays back),
 * the last downbeat's bar extending by the previous bar's length (or to the end
 * of the detection when the grid holds a single downbeat). Within a bar the
 * labels vote weighted by held duration — so a change mid-bar lands on the
 * downbeat of the bar it dominates — and a bar mostly uncovered by any label
 * stays blank (`undefined`) rather than inheriting a passing chord.
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
    dominantLabel(spans, barStart, downbeats[index + 1] ?? lastBarEnd)
  )
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
