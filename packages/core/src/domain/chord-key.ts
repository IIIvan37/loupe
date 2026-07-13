import type { DetectedChordSpan } from './chord-detection.ts'
import {
  type Accidental,
  parseChordSymbol,
  pitchClassOf,
  spellPitchClass
} from './chord-symbol.ts'

/**
 * A musical key: a tonic pitch class (0–11) and a mode. Enough to decide the
 * accidental spelling and to name the key — the grid needs no more (it stores
 * chords verbatim, not scale degrees).
 */
export interface Key {
  readonly tonicPc: number
  readonly mode: 'major' | 'minor'
}

/**
 * The tonic pitch classes whose key signature uses FLATS, per mode. Major:
 * F, Bb, Eb, Ab, Db, Gb. Minor (the relative minors of those): Dm, Gm, Cm,
 * Fm, Bbm, Ebm. Everything else — including C major / A minor, which carry no
 * accidentals — spells with sharps by default. Enharmonic tonics (Gb/F#,
 * Db/C#) resolve to the flat reading, the commoner one for these keys.
 */
const FLAT_MAJOR_TONICS = new Set([5, 10, 3, 8, 1, 6])
const FLAT_MINOR_TONICS = new Set([2, 7, 0, 5, 10, 3])

/** Whether a key spells its accidentals as sharps or flats. */
export function keyAccidental(key: Key): Accidental {
  const flats = key.mode === 'major' ? FLAT_MAJOR_TONICS : FLAT_MINOR_TONICS
  return flats.has(((key.tonicPc % 12) + 12) % 12) ? 'flat' : 'sharp'
}

/** Name a key: its tonic spelled in its own accidental, `m` for a minor key. */
export function keyName(key: Key): string {
  const tonic = spellPitchClass(key.tonicPc, keyAccidental(key))
  return key.mode === 'minor' ? `${tonic}m` : tonic
}

/**
 * The Krumhansl–Kessler tonal-hierarchy profiles: the perceived stability of
 * each scale degree in a major and a minor key. Correlating a piece's
 * pitch-class weights against every rotation of these picks the key.
 */
const MAJOR_PROFILE = [
  6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88
]
const MINOR_PROFILE = [
  6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17
]

/**
 * Detect the key from timestamped chord spans, weighting each pitch class by
 * how long its chords are held (a passing chord counts less than a held one).
 * Each chord contributes its root strongly and its third (major or minor,
 * inferred from the quality) half as much, so the mode reads. The weights
 * correlate against all 24 rotated Krumhansl profiles; the best fit is the key.
 * Silence, unknown roots and empty input leave no evidence — with none, the
 * key is C major (the neutral, all-natural default).
 */
export function detectKey(spans: readonly DetectedChordSpan[]): Key {
  const weights = pitchClassWeights(spans)
  if (weights.every((weight) => weight === 0)) {
    return { tonicPc: 0, mode: 'major' }
  }
  let best: Key = { tonicPc: 0, mode: 'major' }
  let bestScore = Number.NEGATIVE_INFINITY
  for (let tonic = 0; tonic < 12; tonic++) {
    for (const mode of ['major', 'minor'] as const) {
      const profile = mode === 'major' ? MAJOR_PROFILE : MINOR_PROFILE
      const rotated = weights.map(
        (_, pc) => profile[(((pc - tonic) % 12) + 12) % 12] as number
      )
      const score = correlation(weights, rotated)
      if (score > bestScore) {
        bestScore = score
        best = { tonicPc: tonic, mode }
      }
    }
  }
  return best
}

/** Fold spans into a 12-slot pitch-class weight vector (root + third, by held
    duration). */
function pitchClassWeights(spans: readonly DetectedChordSpan[]): number[] {
  const weights = new Array<number>(12).fill(0)
  for (const span of spans) {
    if (span.label === undefined) continue
    const duration = span.endSeconds - span.startSeconds
    if (!(duration > 0)) continue
    const { root, quality } = parseChordSymbol(span.label)
    const rootPc = pitchClassOf(root)
    if (rootPc === undefined) continue
    weights[rootPc] = (weights[rootPc] as number) + duration
    const third = thirdInterval(quality)
    if (third !== undefined) {
      const thirdPc = (rootPc + third) % 12
      weights[thirdPc] = (weights[thirdPc] as number) + duration * 0.5
    }
  }
  return weights
}

/** The chord's third above the root: a minor third for minor/diminished
    qualities, a major third for the rest, none for a suspended chord (which has
    no third to speak of). Quality strings are the grid's own tokens. */
function thirdInterval(quality: string): number | undefined {
  if (quality.startsWith('sus')) return undefined
  const minor =
    quality.startsWith('dim') ||
    (quality.startsWith('m') && !quality.startsWith('maj'))
  return minor ? 3 : 4
}

/** Pearson correlation of two equal-length vectors; 0 when either is flat. */
function correlation(a: readonly number[], b: readonly number[]): number {
  const n = a.length
  const meanA = a.reduce((sum, x) => sum + x, 0) / n
  const meanB = b.reduce((sum, x) => sum + x, 0) / n
  let cov = 0
  let varA = 0
  let varB = 0
  for (let i = 0; i < n; i++) {
    const da = (a[i] as number) - meanA
    const db = (b[i] as number) - meanB
    cov += da * db
    varA += da * da
    varB += db * db
  }
  const denom = Math.sqrt(varA * varB)
  return denom === 0 ? 0 : cov / denom
}
