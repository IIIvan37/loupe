import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { chromaFromSpectrum } from './chroma.ts'
import { spectrumFromSamples } from './spectrum.ts'

const SAMPLE_RATE = 44100
const N = 4096
const BIN_HZ = SAMPLE_RATE / N

function sine(binIndex: number, amplitude = 1): Float32Array {
  const samples = new Float32Array(N)
  const hz = binIndex * BIN_HZ
  for (let i = 0; i < N; i++) {
    samples[i] = amplitude * Math.sin((2 * Math.PI * hz * i) / SAMPLE_RATE)
  }
  return samples
}

function argmax(values: ArrayLike<number>): number {
  let best = 0
  for (let i = 1; i < values.length; i++) {
    if ((values[i] ?? 0) > (values[best] ?? 0)) {
      best = i
    }
  }
  return best
}

describe('spectrumFromSamples', () => {
  it('returns one magnitude per analyser-convention bin', () => {
    const frame = spectrumFromSamples(sine(100), SAMPLE_RATE)
    expect(frame.magnitudes.length).toBe(N / 2)
    expect(frame.sampleRate).toBe(SAMPLE_RATE)
  })

  it('peaks at the bin of a pure sine', () => {
    const frame = spectrumFromSamples(sine(100), SAMPLE_RATE)
    expect(argmax(frame.magnitudes)).toBe(100)
  })

  it('resolves two simultaneous notes as two dominant peaks', () => {
    const samples = new Float32Array(N)
    const a = sine(60)
    const b = sine(200, 0.8)
    for (let i = 0; i < N; i++) {
      samples[i] = (a[i] ?? 0) + (b[i] ?? 0)
    }
    const frame = spectrumFromSamples(samples, SAMPLE_RATE)
    const sorted = Array.from(frame.magnitudes.keys()).sort(
      (i, j) => (frame.magnitudes[j] ?? 0) - (frame.magnitudes[i] ?? 0)
    )
    // The two loudest bins land on (or hug) the two injected frequencies.
    expect(sorted.slice(0, 4).some((i) => Math.abs(i - 60) <= 1)).toBe(true)
    expect(sorted.slice(0, 4).some((i) => Math.abs(i - 200) <= 1)).toBe(true)
  })

  it('a louder note reads louder', () => {
    const loud = spectrumFromSamples(sine(100, 1), SAMPLE_RATE)
    const quiet = spectrumFromSamples(sine(100, 0.25), SAMPLE_RATE)
    expect(loud.magnitudes[100] ?? 0).toBeGreaterThan(
      quiet.magnitudes[100] ?? 0
    )
  })

  it('silence yields an all-zero spectrum', () => {
    const frame = spectrumFromSamples(new Float32Array(N), SAMPLE_RATE)
    expect(Array.from(frame.magnitudes).every((m) => m === 0)).toBe(true)
  })

  it('a DC offset stays on bin 0 — never a candidate note', () => {
    const samples = new Float32Array(N).fill(0.5)
    const frame = spectrumFromSamples(samples, SAMPLE_RATE)
    expect(argmax(frame.magnitudes)).toBe(0)
    // Musical bins stay silent enough that chroma reads nothing.
    const chroma = chromaFromSpectrum(frame.magnitudes, SAMPLE_RATE)
    expect(Math.max(...chroma)).toBeLessThanOrEqual(1)
  })

  it('rejects a window whose length is not a power of two', () => {
    expect(() =>
      spectrumFromSamples(new Float32Array(1000), SAMPLE_RATE)
    ).toThrow(/power of two/)
  })

  it('rejects a window too short to transform', () => {
    expect(() => spectrumFromSamples(new Float32Array(1), SAMPLE_RATE)).toThrow(
      /power of two/
    )
  })

  it('accepts the smallest power-of-two window', () => {
    const frame = spectrumFromSamples(new Float32Array(2), SAMPLE_RATE)
    expect(frame.magnitudes.length).toBe(1)
  })

  it('a unit on-bin sine reads the Hann coherent gain (~0.5)', () => {
    // Pins the window's mean AND the 2/n magnitude scale — a distorted
    // window (or a wrong scale) lands far outside this band.
    const frame = spectrumFromSamples(sine(100), SAMPLE_RATE)
    expect(frame.magnitudes[100] ?? 0).toBeGreaterThan(0.4)
    expect(frame.magnitudes[100] ?? 0).toBeLessThan(0.6)
  })

  it('confines an off-bin tone — the Hann skirt, not rectangular leakage', () => {
    // A half-bin tone is the worst leakage case: a proper Hann keeps the
    // skirt >40 dB below the peak a few bins out, any edge-heavy window
    // (the shape a mutated formula produces) leaks orders of magnitude more.
    const samples = new Float32Array(N)
    const hz = 100.5 * BIN_HZ
    for (let i = 0; i < N; i++) {
      samples[i] = Math.sin((2 * Math.PI * hz * i) / SAMPLE_RATE)
    }
    const frame = spectrumFromSamples(samples, SAMPLE_RATE)
    const peak = Math.max(
      frame.magnitudes[100] ?? 0,
      frame.magnitudes[101] ?? 0
    )
    expect(peak).toBeGreaterThan(0.3)
    for (const bin of [90, 95, 110, 120]) {
      expect(frame.magnitudes[bin] ?? 0).toBeLessThan(peak * 0.01)
    }
  })

  it('feeds chromaFromSpectrum: A440 lights the A class', () => {
    const samples = new Float32Array(N)
    for (let i = 0; i < N; i++) {
      samples[i] = Math.sin((2 * Math.PI * 440 * i) / SAMPLE_RATE)
    }
    const frame = spectrumFromSamples(samples, SAMPLE_RATE)
    const chroma = chromaFromSpectrum(frame.magnitudes, SAMPLE_RATE)
    expect(argmax(chroma)).toBe(9) // A
  })

  it('the dominant bin tracks any pure sine', () => {
    fc.assert(
      fc.property(fc.integer({ min: 4, max: N / 2 - 2 }), (bin) => {
        const frame = spectrumFromSamples(sine(bin), SAMPLE_RATE)
        expect(argmax(frame.magnitudes)).toBe(bin)
      })
    )
  })
})
