/**
 * Fold a magnitude spectrum onto the 12 pitch classes (C = 0 … B = 11) — the
 * « peaks = candidate notes » read-out of the Spectre tab. Values in, values
 * out: bin `i` of an N-bin spectrum covers `i · sampleRate / (2N)` Hz (the
 * analyser convention); each bin's energy lands on the class of its nearest
 * equal-tempered pitch. The result is normalised so the loudest class reads 1
 * (a silent spectrum stays all-zero).
 */

/** Musically useful band: below ~C1 the bins are wider than a semitone, above
 * ~C7 the harmonics of every note blur the classes together. */
const MIN_HZ = 32
const MAX_HZ = 2100

export function chromaFromSpectrum(
  magnitudes: ArrayLike<number>,
  sampleRate: number
): readonly number[] {
  const classes = new Array<number>(12).fill(0)
  const binHz = sampleRate / (2 * magnitudes.length)
  for (let i = 1; i < magnitudes.length; i++) {
    const hz = i * binHz
    if (hz < MIN_HZ || hz > MAX_HZ) {
      continue
    }
    // MIDI note of the bin centre; midi % 12 puts C at 0 (A440 = midi 69).
    const midi = Math.round(12 * Math.log2(hz / 440) + 69)
    const pitchClass = ((midi % 12) + 12) % 12
    classes[pitchClass] = (classes[pitchClass] ?? 0) + (magnitudes[i] ?? 0)
  }
  const loudest = Math.max(...classes)
  return loudest > 0 ? classes.map((v) => v / loudest) : classes
}
