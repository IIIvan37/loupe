/**
 * Fold a magnitude spectrum onto the 12 pitch classes (C = 0 … B = 11) — the
 * « peaks = candidate notes » read-out of the Spectre tab. Values in, values
 * out: bin `i` of an N-bin spectrum covers `i · sampleRate / (2N)` Hz (the
 * analyser convention); each bin's energy lands on the class of its nearest
 * equal-tempered pitch. The result is normalised so the loudest class reads 1
 * (a silent spectrum stays all-zero).
 */

/** Musically useful band: below ~C1 the bins are wider than a semitone, above
 * ~C7 the harmonics of every note blur the classes together. Exported so
 * in-app synthesized sounds (the metronome click) can PROVE they stay out of
 * the band instead of painting fake candidate notes (Z.1). */
export const CHROMA_MIN_HZ = 32
export const CHROMA_MAX_HZ = 2100

export function chromaFromSpectrum(
  magnitudes: ArrayLike<number>,
  sampleRate: number
): readonly number[] {
  const classes = new Array<number>(12).fill(0)
  const binHz = sampleRate / (2 * magnitudes.length)
  for (let i = 1; i < magnitudes.length; i++) {
    const hz = i * binHz
    if (hz < CHROMA_MIN_HZ || hz > CHROMA_MAX_HZ) {
      continue
    }
    classes[pitchClassOf(hz)] =
      (classes[pitchClassOf(hz)] ?? 0) + (magnitudes[i] ?? 0)
  }
  const loudest = Math.max(...classes)
  return loudest > 0 ? classes.map((v) => v / loudest) : classes
}

/** MIDI pitch class of a frequency; midi % 12 puts C at 0 (A440 = midi 69). */
function pitchClassOf(hz: number): number {
  const midi = Math.round(12 * Math.log2(hz / 440) + 69)
  return ((midi % 12) + 12) % 12
}

/** A local maximum below this fraction of the loudest peak is window skirt /
 * noise, never a candidate note or harmonic. */
const PEAK_FLOOR = 0.05
/** Harmonic series reach: partials 2…8 cover what instruments radiate loud
 * enough to paint phantom classes (the 3rd = a fifth, the 5th = a third). */
const HARMONIC_MAX_MULTIPLE = 8
/** How far a peak may sit from an exact integer multiple and still read as
 * that harmonic — widened to a full bin where bins are coarser than cents. */
const HARMONIC_TOLERANCE_CENTS = 30

/**
 * The chroma fold, with each class's share of energy that is only a probable
 * HARMONIC of a lower note — the Spectre's « distinguish, never filter »
 * read-out (pre-beta point 3). Peaks (in-band local maxima above the floor)
 * are marked harmonic when some lower peak explains them as an integer
 * multiple (2…8, ±30 cents or one bin); everything else is played. `chroma`
 * is exactly `chromaFromSpectrum` — the bars keep their height, the share
 * only dims the harmonic fraction. Caveat by design: a real note sitting on
 * another's multiple (an octave, a bare fifth) reads harmonic too — hence
 * « probable », not certain.
 */
export function chromaWithHarmonics(
  magnitudes: ArrayLike<number>,
  sampleRate: number
): {
  readonly chroma: readonly number[]
  readonly harmonicShare: readonly number[]
} {
  const chroma = chromaFromSpectrum(magnitudes, sampleRate)
  const binHz = sampleRate / (2 * magnitudes.length)
  const peaks: Array<{ hz: number; magnitude: number }> = []
  let loudest = 0
  for (let i = 1; i < magnitudes.length - 1; i++) {
    const hz = i * binHz
    const magnitude = magnitudes[i] ?? 0
    if (
      hz >= CHROMA_MIN_HZ &&
      hz <= CHROMA_MAX_HZ &&
      magnitude > (magnitudes[i - 1] ?? 0) &&
      magnitude > (magnitudes[i + 1] ?? 0)
    ) {
      peaks.push({ hz, magnitude })
      loudest = Math.max(loudest, magnitude)
    }
  }
  const played = new Array<number>(12).fill(0)
  const harmonic = new Array<number>(12).fill(0)
  const candidates = peaks.filter((p) => p.magnitude >= PEAK_FLOOR * loudest)
  for (const peak of candidates) {
    const explained = candidates.some((lower) => {
      if (lower.hz >= peak.hz) {
        return false
      }
      const multiple = Math.round(peak.hz / lower.hz)
      if (multiple < 2 || multiple > HARMONIC_MAX_MULTIPLE) {
        return false
      }
      const target = multiple * lower.hz
      const centsWindow = target * (2 ** (HARMONIC_TOLERANCE_CENTS / 1200) - 1)
      return Math.abs(peak.hz - target) <= Math.max(binHz, centsWindow)
    })
    const bucket = explained ? harmonic : played
    const pitchClass = pitchClassOf(peak.hz)
    bucket[pitchClass] = (bucket[pitchClass] ?? 0) + peak.magnitude
  }
  const harmonicShare = harmonic.map((h, pitchClass) => {
    const total = h + (played[pitchClass] ?? 0)
    return total > 0 ? h / total : 0
  })
  return { chroma, harmonicShare }
}
