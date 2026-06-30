/**
 * Adaptive instrument detection. A separator always emits a fixed roster of
 * stems (htdemucs: voice/drums/bass/other), but a given track rarely uses them
 * all — the absent ones come back as near-silence. From each stem's energy this
 * decides which are actually *present* and attaches a heuristic confidence, so
 * the UI can show only the instruments that are really there. Pure: values in,
 * values out — no model, no I/O.
 */

/** One stem's overall loudness, the raw input to detection. */
export interface StemEnergy {
  readonly id: string
  readonly energy: number
}

/** The detection verdict for one stem. */
export interface DetectedStem {
  readonly id: string
  /** Heuristic confidence the instrument is present, in [0, 1]. */
  readonly confidence: number
  /** Whether the stem carries enough energy to be worth showing. */
  readonly present: boolean
}

/**
 * Minimum share of the loudest stem's energy for a stem to read as present.
 * Below it, a stem is treated as bleed/silence and masked from the track list.
 */
export const PRESENCE_THRESHOLD = 0.05

/**
 * Root-mean-square amplitude over every sample of every channel — a single
 * loudness figure for a stem. Silence (and the empty signal) yields 0.
 */
export function stemEnergy(channels: ReadonlyArray<ArrayLike<number>>): number {
  let sumSquares = 0
  let count = 0
  for (const channel of channels) {
    for (let i = 0; i < channel.length; i++) {
      const value = channel[i] as number
      sumSquares += value * value
      count++
    }
  }
  return count === 0 ? 0 : Math.sqrt(sumSquares / count)
}

/**
 * Decide which stems are present and how confident we are. Confidence is each
 * stem's energy relative to the loudest one, so the loudest is always 1 and an
 * all-silent mix scores everything 0. A stem is present when that share reaches
 * `PRESENCE_THRESHOLD`; verdicts come back in input order.
 */
export function detectInstruments(
  energies: readonly StemEnergy[]
): readonly DetectedStem[] {
  const loudest = energies.reduce((max, e) => Math.max(max, e.energy), 0)
  return energies.map(({ id, energy }) => {
    const confidence = loudest > 0 ? energy / loudest : 0
    return { id, confidence, present: confidence >= PRESENCE_THRESHOLD }
  })
}
