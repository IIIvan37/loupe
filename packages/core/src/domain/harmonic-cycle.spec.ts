import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { detectCycle } from './harmonic-cycle.ts'

/** An 8-bar chorus used across the examples. */
const CHORUS = ['C', 'Am', 'F', 'G', 'C', 'Am', 'Dm', 'G7']

describe('detectCycle', () => {
  it('finds the period of two exact choruses', () => {
    expect(detectCycle([...CHORUS, ...CHORUS])?.period).toBe(8)
  })

  it('counts three choruses', () => {
    expect(detectCycle([...CHORUS, ...CHORUS, ...CHORUS])?.count).toBe(3)
  })

  it('reports the smallest period that explains the song', () => {
    const song = [...CHORUS, ...CHORUS, ...CHORUS, ...CHORUS]
    expect(detectCycle(song)?.period).toBe(8)
  })

  it('a short leftover is the tail, not part of the cycle', () => {
    const song = [...CHORUS, ...CHORUS, 'C', 'F', 'C', 'C']
    expect(detectCycle(song)?.tail).toBe(4)
  })

  it('a leftover longer than half a period disqualifies the lag', () => {
    const song = [...CHORUS, ...CHORUS, 'C', 'F', 'C', 'C', 'G', 'A7']
    expect(detectCycle(song)).toBeUndefined()
  })

  it('hears the cycle past a four-bar intro', () => {
    const intro = ['N.C.', 'N.C.', 'C', 'G']
    expect(detectCycle([...intro, ...CHORUS, ...CHORUS])?.intro).toBe(4)
  })

  it('an unrepeated song has no cycle', () => {
    const song = Array.from({ length: 16 }, (_, index) => `X${index}`)
    expect(detectCycle(song)).toBeUndefined()
  })

  it('silence proves nothing — an all-blank song has no cycle', () => {
    expect(
      detectCycle(Array.from({ length: 16 }, () => undefined))
    ).toBeUndefined()
  })

  it('one mis-detected bar does not break the cycle', () => {
    const noisy = ['C', 'Am', 'F', 'G', 'C', 'A7', 'Dm', 'G7']
    expect(detectCycle([...CHORUS, ...noisy])?.period).toBe(8)
  })

  it('property — exact copies always yield a consistent accounting', () => {
    const chord = fc.constantFrom('C', 'Dm', 'Em', 'F', 'G', 'Am', 'Bb')
    const cycle = fc
      .constantFrom(8, 12, 16)
      .chain((period) =>
        fc.array(chord, { minLength: period, maxLength: period })
      )
    fc.assert(
      fc.property(cycle, fc.integer({ min: 2, max: 4 }), (bars, copies) => {
        const song = Array.from({ length: copies }, () => bars).flat()
        const found = detectCycle(song)
        return (
          found !== undefined &&
          found.period <= bars.length &&
          found.intro + found.period * found.count + found.tail === song.length
        )
      })
    )
  })
})
