import { sequenceAgreement } from './section-matching.ts'

type MeasureLabels = readonly (string | undefined)[]

/** How much of the shifted overlap must agree before a lag reads as the
    song's harmonic cycle. */
const CYCLE_THRESHOLD = 0.8

/** Candidate periods and intros move in whole phrases — multiples of four
    bars, the grain every common form (8, 12, 16, 32) is built on. */
const PHRASE = 4

/** The shortest period worth calling a form — below this, `deduceStructure`'s
    plain tiling already explains the song as a repeated section. */
const MIN_PERIOD = 8

/** The intro lengths worth trying before the first chorus. */
const INTRO_OFFSETS = [0, PHRASE, 2 * PHRASE]

export interface HarmonicCycle {
  /** The cycle's length in measures. */
  readonly period: number
  /** Full passes of the cycle — at least 2, or there is no cycle. */
  readonly count: number
  /** Leftover measures after the last full pass (an outro), < period / 2. */
  readonly tail: number
  /** Measures before the first pass (an intro), 0 when none. */
  readonly intro: number
}

/**
 * The song's minimal harmonic cycle, by autocorrelation on the per-measure
 * chord labels: the smallest phrase-aligned lag whose shifted overlap agrees
 * with itself. The FORM (one cycle) then separates from the ROLLOUT (how many
 * passes) — the whole point: one written cycle plus "×N", never a page of
 * copies. A tail longer than half a period is not a leftover but a
 * counter-example, and silence is never evidence — an all-blank overlap
 * proves no cycle. `undefined` when the song simply does not repeat.
 */
export function detectCycle(labels: MeasureLabels): HarmonicCycle | undefined {
  for (let period = MIN_PERIOD; period * 2 <= labels.length; period += PHRASE) {
    let best: HarmonicCycle | undefined
    let bestRatio = 0
    for (const intro of INTRO_OFFSETS) {
      const count = Math.floor((labels.length - intro) / period)
      if (count < 2) continue
      const tail = labels.length - intro - count * period
      if (tail * 2 > period) continue
      const body = labels.slice(intro, intro + count * period)
      const { ratio, evidence } = sequenceAgreement(
        body.slice(0, body.length - period),
        body.slice(period)
      )
      if (evidence * 2 < period) continue
      if (ratio >= CYCLE_THRESHOLD && ratio > bestRatio) {
        bestRatio = ratio
        best = { period, count, tail, intro }
      }
    }
    if (best !== undefined) return best
  }
  return undefined
}
