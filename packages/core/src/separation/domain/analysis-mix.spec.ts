import { describe, expect, it } from 'vitest'
import { monoMixWithout } from './analysis-mix.ts'

const stem = (id: string, samples: number[], sampleRate = 8) => ({
  id,
  audio: { sampleRate, channels: [new Float32Array(samples)] }
})

describe('monoMixWithout', () => {
  it('sums every stem except the excluded one', () => {
    const mix = monoMixWithout(
      [
        stem('bass', [0.2, 0.2]),
        stem('vocals', [0.3, 0.1]),
        stem('drums', [0.4, 0.4])
      ],
      'drums'
    )
    expect(Array.from(mix?.channels[0] ?? [])).toEqual([
      expect.closeTo(0.5, 5),
      expect.closeTo(0.3, 5)
    ])
  })

  it('downmixes multi-channel stems before summing', () => {
    const mix = monoMixWithout(
      [
        {
          id: 'other',
          audio: {
            sampleRate: 8,
            channels: [new Float32Array([1, 0]), new Float32Array([0, 0])]
          }
        }
      ],
      'drums'
    )
    expect(Array.from(mix?.channels[0] ?? [])).toEqual([0.5, 0])
  })

  it('pads to the longest stem — a shorter tail stays silent, not cut', () => {
    const mix = monoMixWithout(
      [stem('bass', [0.5]), stem('vocals', [0.25, 0.25])],
      'drums'
    )
    expect(Array.from(mix?.channels[0] ?? [])).toEqual([0.75, 0.25])
  })

  it('skips a channel-less stem instead of crashing the mix', () => {
    const mix = monoMixWithout(
      [
        { id: 'other', audio: { sampleRate: 8, channels: [] } },
        stem('bass', [0.5, 0.5])
      ],
      'drums'
    )
    expect(Array.from(mix?.channels[0] ?? [])).toEqual([0.5, 0.5])
  })

  it('yields nothing when only the excluded stem exists', () => {
    expect(monoMixWithout([stem('drums', [1, 1])], 'drums')).toBeUndefined()
  })

  it('yields nothing for no stems at all', () => {
    expect(monoMixWithout([], 'drums')).toBeUndefined()
  })

  it('carries the stems sample rate through', () => {
    expect(monoMixWithout([stem('bass', [0.1])], 'drums')?.sampleRate).toBe(8)
  })
})
