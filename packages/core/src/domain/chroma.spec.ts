import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { chromaFromSpectrum } from './chroma.ts'

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
