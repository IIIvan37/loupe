import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { chromaFromSpectrum, chromaWithHarmonics } from './chroma.ts'

/** A spectrum of `bins` zeros with a single magnitude-1 peak at `hz`. */
function peakAt(hz: number, sampleRate = 44100, bins = 2048): number[] {
  const magnitudes = new Array<number>(bins).fill(0)
  // Bin i covers i * sampleRate / (2 * bins) Hz (analyser bin convention).
  magnitudes[Math.round((hz * 2 * bins) / sampleRate)] = 1
  return magnitudes
}

describe('chromaFromSpectrum', () => {
  it('folds a 440 Hz peak onto pitch class A', () => {
    const chroma = chromaFromSpectrum(peakAt(440), 44100)
    expect(chroma.indexOf(Math.max(...chroma))).toBe(9)
  })

  it('folds a middle-C peak onto pitch class C', () => {
    const chroma = chromaFromSpectrum(peakAt(261.63), 44100)
    expect(chroma.indexOf(Math.max(...chroma))).toBe(0)
  })

  it('folds an octave-apart pair onto the same single class', () => {
    const spectrum = peakAt(220)
    spectrum[Math.round((440 * 2 * spectrum.length) / 44100)] = 1
    const chroma = chromaFromSpectrum(spectrum, 44100)
    expect(chroma.filter((v) => v > 0)).toEqual([1])
  })

  it('normalises the loudest class to 1', () => {
    const spectrum = peakAt(440)
    spectrum[Math.round((261.63 * 2 * spectrum.length) / 44100)] = 0.5
    const chroma = chromaFromSpectrum(spectrum, 44100)
    expect(Math.max(...chroma)).toBe(1)
  })

  it('ignores rumble below the musical band', () => {
    expect(chromaFromSpectrum(peakAt(20), 44100)).toEqual(new Array(12).fill(0))
  })

  it('ignores content above the musical band', () => {
    expect(chromaFromSpectrum(peakAt(4200), 44100)).toEqual(
      new Array(12).fill(0)
    )
  })

  it('keeps a bin sitting exactly on the low edge of the band', () => {
    // 64 bins at 4096 Hz → bin 1 covers exactly 32 Hz (= MIN_HZ).
    const spectrum = new Array<number>(64).fill(0)
    spectrum[1] = 1
    expect(Math.max(...chromaFromSpectrum(spectrum, 4096))).toBe(1)
  })

  it('keeps a bin sitting exactly on the high edge of the band', () => {
    // 100 bins at 42 kHz → bin 10 covers exactly 2100 Hz (= MAX_HZ).
    const spectrum = new Array<number>(100).fill(0)
    spectrum[10] = 1
    expect(Math.max(...chromaFromSpectrum(spectrum, 42000))).toBe(1)
  })

  it('returns all-zero for a silent spectrum', () => {
    const chroma = chromaFromSpectrum(new Array(2048).fill(0), 44100)
    expect(chroma).toEqual(new Array(12).fill(0))
  })

  it('always yields 12 values in [0, 1]', () => {
    fc.assert(
      fc.property(
        fc.array(fc.double({ min: 0, max: 1e6, noNaN: true }), {
          minLength: 8,
          maxLength: 512
        }),
        (magnitudes) => {
          const chroma = chromaFromSpectrum(magnitudes, 44100)
          expect(
            chroma.length === 12 &&
              chroma.every((v) => v >= 0 && v <= 1 && Number.isFinite(v))
          ).toBe(true)
        }
      )
    )
  })
})

/** A spectrum with magnitude peaks at given `[hz, magnitude]` pairs. */
function peaksAt(
  peaks: ReadonlyArray<readonly [number, number]>,
  sampleRate = 44100,
  bins = 2048
): number[] {
  const magnitudes = new Array<number>(bins).fill(0)
  for (const [hz, magnitude] of peaks) {
    magnitudes[Math.round((hz * 2 * bins) / sampleRate)] = magnitude
  }
  return magnitudes
}

describe('chromaWithHarmonics', () => {
  it('marks nothing on a lone note — no harmonic to explain', () => {
    const { harmonicShare } = chromaWithHarmonics(peaksAt([[440, 1]]), 44100)
    expect(harmonicShare).toEqual(new Array(12).fill(0))
  })

  it('keeps the chroma identical to the plain fold', () => {
    const spectrum = peaksAt([
      [440, 1],
      [880, 0.5],
      [1320, 0.3]
    ])
    const { chroma } = chromaWithHarmonics(spectrum, 44100)
    expect(chroma).toEqual(chromaFromSpectrum(spectrum, 44100))
  })

  it('marks the twelfth (3× the fundamental) as fully harmonic', () => {
    // A played A (440) whose 3rd harmonic paints a phantom E (1320).
    const { harmonicShare } = chromaWithHarmonics(
      peaksAt([
        [440, 1],
        [1320, 0.3]
      ]),
      44100
    )
    expect(harmonicShare[4]).toBe(1) // E: pure artifact
    expect(harmonicShare[9]).toBe(0) // A: the played note
  })

  it('reports the harmonic fraction of a class mixing both', () => {
    // The octave (880) folds onto A too: A = 1 played + 0.5 harmonic.
    const { harmonicShare } = chromaWithHarmonics(
      peaksAt([
        [440, 1],
        [880, 0.5]
      ]),
      44100
    )
    expect(harmonicShare[9]).toBeCloseTo(0.5 / 1.5, 5)
  })

  it('leaves two unrelated notes both fully played', () => {
    // A (440) and D (588) share no integer ratio — nobody explains anybody.
    const { harmonicShare } = chromaWithHarmonics(
      peaksAt([
        [440, 1],
        [588, 0.8]
      ]),
      44100
    )
    expect(harmonicShare[9]).toBe(0)
    expect(harmonicShare[2]).toBe(0)
  })

  it('a detuned near-multiple beyond tolerance stays played', () => {
    // 925 Hz is ~85 cents above 2×440 — out of the ±30-cent net.
    const { harmonicShare } = chromaWithHarmonics(
      peaksAt([
        [440, 1],
        [925, 0.5]
      ]),
      44100
    )
    expect(Math.max(...harmonicShare)).toBe(0)
  })

  it('faint skirt energy below the peak floor is never a harmonic', () => {
    const { harmonicShare } = chromaWithHarmonics(
      peaksAt([
        [440, 1],
        [880, 0.01]
      ]),
      44100
    )
    expect(harmonicShare[9]).toBe(0)
  })

  it('explains a harmonic through ANY lower peak — chains included', () => {
    // 129 Hz (C3) with its 5th harmonic (645 Hz ≈ E5): k = 5 within reach.
    const { harmonicShare } = chromaWithHarmonics(
      peaksAt([
        [129, 1],
        [645, 0.4]
      ]),
      44100
    )
    expect(harmonicShare[4]).toBe(1)
  })

  it('a flat-topped bump is never a peak — only strict maxima count', () => {
    // Two equal adjacent bins at 2× the fundamental: no strict local max,
    // so nothing to mark harmonic.
    const spectrum = peaksAt([[440, 1]])
    const octave = Math.round((880 * 2 * 2048) / 44100)
    spectrum[octave] = 0.5
    spectrum[octave + 1] = 0.5
    const { harmonicShare } = chromaWithHarmonics(spectrum, 44100)
    expect(harmonicShare[9]).toBe(0)
  })

  it('the peak floor scales WITH the loudest peak, never against it', () => {
    // Loudest 0.5 → floor 0.025: a 0.06 octave passes. A floor computed as
    // 0.05 / loudest (= 0.1) would wrongly drop it.
    const { harmonicShare } = chromaWithHarmonics(
      peaksAt([
        [440, 0.5],
        [880, 0.06]
      ]),
      44100
    )
    expect(harmonicShare[9]).toBeCloseTo(0.06 / 0.56, 5)
  })

  it('the 9th multiple sits beyond the harmonic net — played', () => {
    // Partials above 8 are too faint to paint classes; a peak there is a note.
    const { harmonicShare } = chromaWithHarmonics(
      peaksAt([
        [129, 1],
        [1161, 0.4]
      ]),
      44100
    )
    expect(Math.max(...harmonicShare)).toBe(0)
  })

  it('the tolerance widens to a full bin where bins are coarser than cents', () => {
    // Bin 5 (53.8 Hz) and bin 11 (118.4 Hz): a full bin from the exact 2×
    // (107.7 Hz) — far beyond ±30 cents, but exactly one bin, so it reads
    // as the octave harmonic of a coarse low-range fundamental.
    const spectrum = new Array<number>(2048).fill(0)
    spectrum[5] = 1
    spectrum[11] = 0.5
    const { harmonicShare } = chromaWithHarmonics(spectrum, 44100)
    expect(Math.max(...harmonicShare)).toBe(1)
  })

  it('stacked harmonics of one class accumulate into its share', () => {
    // Fundamental + two octave partials, all folding onto A: the share sums
    // BOTH harmonics, not just the last one seen.
    const { harmonicShare } = chromaWithHarmonics(
      peaksAt([
        [440, 1],
        [880, 0.5],
        [1760, 0.3]
      ]),
      44100
    )
    expect(harmonicShare[9]).toBeCloseTo(0.8 / 1.8, 5)
  })

  it('the 8th partial is still in the net', () => {
    // 129.2 Hz × 8 ≈ 1034 Hz — three octaves up, same class: the top of the
    // reach dims its fraction of C.
    const spectrum = new Array<number>(2048).fill(0)
    spectrum[12] = 1
    spectrum[96] = 0.3
    const { harmonicShare } = chromaWithHarmonics(spectrum, 44100)
    expect(harmonicShare[0]).toBeCloseTo(0.3 / 1.3, 5)
  })

  it('two strings a hair apart are two played notes, never harmonics', () => {
    // ~23 cents apart at 1.6 kHz: the k = 1 "multiple" is not a harmonic —
    // a detuned unison must not dim itself.
    const spectrum = new Array<number>(2048).fill(0)
    spectrum[150] = 1
    spectrum[152] = 0.4
    const { harmonicShare } = chromaWithHarmonics(spectrum, 44100)
    expect(Math.max(...harmonicShare)).toBe(0)
  })

  it('a sub-band rumble explains no harmonic — fundamentals live in band', () => {
    // Bin 2 (21.5 Hz, under the 32 Hz floor) with bin 6 at exactly 3×: the
    // rumble is no candidate, so the in-band peak stays played.
    const spectrum = new Array<number>(2048).fill(0)
    spectrum[2] = 1
    spectrum[6] = 0.5
    const { harmonicShare } = chromaWithHarmonics(spectrum, 44100)
    expect(Math.max(...harmonicShare)).toBe(0)
  })

  it('an above-band peak is never marked into the classes', () => {
    // 2200 Hz (over the 2100 Hz roof) is 2× of 1100: out of band, out of
    // the read-out — no phantom share appears for its class.
    const { harmonicShare } = chromaWithHarmonics(
      peaksAt([
        [1100, 1],
        [2200, 0.5]
      ]),
      44100
    )
    expect(Math.max(...harmonicShare)).toBe(0)
  })

  it('a fundamental sitting exactly on the band floor counts', () => {
    // 64 bins at 4096 Hz → bin 1 is exactly 32 Hz (= MIN): it explains its
    // twelfth at bin 3 (96 Hz — class G, distinct from C).
    const spectrum = new Array<number>(64).fill(0)
    spectrum[1] = 1
    spectrum[3] = 0.5
    const { harmonicShare } = chromaWithHarmonics(spectrum, 4096)
    expect(Math.max(...harmonicShare)).toBe(1)
  })

  it('a harmonic sitting exactly on the band roof counts', () => {
    // 100 bins at 14 kHz → bin 30 is exactly 2100 Hz (= MAX): the 3rd
    // partial of bin 10 (700 Hz) still reads harmonic — distinct class.
    const spectrum = new Array<number>(100).fill(0)
    spectrum[10] = 1
    spectrum[30] = 0.5
    const { harmonicShare } = chromaWithHarmonics(spectrum, 14000)
    expect(Math.max(...harmonicShare)).toBe(1)
  })

  it('the last bin has no right neighbour — never a peak', () => {
    // 64 bins at 4096 Hz: the final bin (2016 Hz, in band) sits at exactly
    // 3× bin 21 but cannot be a strict local maximum.
    const spectrum = new Array<number>(64).fill(0)
    spectrum[21] = 1
    spectrum[63] = 0.5
    const { harmonicShare } = chromaWithHarmonics(spectrum, 4096)
    expect(Math.max(...harmonicShare)).toBe(0)
  })

  it('a silent spectrum reports no shares', () => {
    const { chroma, harmonicShare } = chromaWithHarmonics(
      new Array(2048).fill(0),
      44100
    )
    expect(chroma).toEqual(new Array(12).fill(0))
    expect(harmonicShare).toEqual(new Array(12).fill(0))
  })
})
