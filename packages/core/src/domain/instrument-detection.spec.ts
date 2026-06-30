import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  detectInstruments,
  PRESENCE_THRESHOLD,
  type StemEnergy,
  stemEnergy
} from './instrument-detection.ts'

describe('stemEnergy', () => {
  it('is zero for silence', () => {
    expect(stemEnergy([[0, 0, 0, 0]])).toBe(0)
  })

  it('is the RMS amplitude of a single channel', () => {
    // RMS of [1, -1, 1, -1] = sqrt(mean of 1s) = 1.
    expect(stemEnergy([[1, -1, 1, -1]])).toBe(1)
    // RMS of [0.5, -0.5] = 0.5.
    expect(stemEnergy([[0.5, -0.5]])).toBe(0.5)
  })

  it('averages the squared samples across every channel', () => {
    // Channel A all 1s, channel B all 0s → mean square = 0.5 → RMS = sqrt(0.5).
    expect(
      stemEnergy([
        [1, 1],
        [0, 0]
      ])
    ).toBeCloseTo(Math.SQRT1_2)
  })

  it('is zero when there are no samples', () => {
    expect(stemEnergy([[]])).toBe(0)
    expect(stemEnergy([])).toBe(0)
  })

  it('never exceeds the peak absolute amplitude', () => {
    fc.assert(
      fc.property(
        fc.array(fc.double({ min: -1, max: 1, noNaN: true }), { minLength: 1 }),
        (samples) => {
          const peak = Math.max(...samples.map(Math.abs))
          expect(stemEnergy([samples])).toBeLessThanOrEqual(peak + 1e-9)
        }
      )
    )
  })
})

describe('detectInstruments', () => {
  it('scores confidence as energy relative to the loudest stem', () => {
    const energies: StemEnergy[] = [
      { id: 'drums', energy: 1 },
      { id: 'bass', energy: 0.5 },
      { id: 'vox', energy: 0.25 }
    ]
    expect(detectInstruments(energies)).toEqual([
      { id: 'drums', confidence: 1, present: true },
      { id: 'bass', confidence: 0.5, present: true },
      { id: 'vox', confidence: 0.25, present: true }
    ])
  })

  it('masks a stem whose energy is a negligible share of the loudest', () => {
    const energies: StemEnergy[] = [
      { id: 'drums', energy: 1 },
      { id: 'bass', energy: PRESENCE_THRESHOLD / 2 }
    ]
    const detected = detectInstruments(energies)
    expect(detected[1]?.present).toBe(false)
    expect(detected[0]?.present).toBe(true)
  })

  it('keeps a stem exactly at the threshold', () => {
    const detected = detectInstruments([
      { id: 'drums', energy: 1 },
      { id: 'bass', energy: PRESENCE_THRESHOLD }
    ])
    expect(detected[1]?.present).toBe(true)
  })

  it('marks every stem absent when the whole mix is silent', () => {
    expect(
      detectInstruments([
        { id: 'a', energy: 0 },
        { id: 'b', energy: 0 }
      ])
    ).toEqual([
      { id: 'a', confidence: 0, present: false },
      { id: 'b', confidence: 0, present: false }
    ])
  })

  it('returns nothing for no stems', () => {
    expect(detectInstruments([])).toEqual([])
  })

  const nonEmptyEnergies = fc.array(
    fc.record({
      id: fc.string(),
      energy: fc.double({ min: 0, max: 1e6, noNaN: true })
    }),
    { minLength: 1 }
  )

  it('always keeps at least the loudest stem when any energy is present', () => {
    fc.assert(
      fc.property(nonEmptyEnergies, (energies) => {
        const detected = detectInstruments(energies)
        const anyEnergy = energies.some((e) => e.energy > 0)
        expect(detected.some((d) => d.present)).toBe(anyEnergy)
      })
    )
  })

  it('keeps every confidence within [0, 1]', () => {
    fc.assert(
      fc.property(nonEmptyEnergies, (energies) => {
        for (const { confidence } of detectInstruments(energies)) {
          expect(confidence).toBeGreaterThanOrEqual(0)
          expect(confidence).toBeLessThanOrEqual(1)
        }
      })
    )
  })
})
