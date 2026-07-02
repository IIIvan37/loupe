import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { padChannels, stemExportFilename } from './stem-export.ts'

describe('stemExportFilename', () => {
  it('numbers the file from its display position, two digits, .wav', () => {
    expect(stemExportFilename(0, 'Voix')).toBe('01_Voix.wav')
    expect(stemExportFilename(9, 'Batterie')).toBe('10_Batterie.wav')
  })

  it('keeps the label verbatim for any position', () => {
    fc.assert(
      fc.property(fc.nat(98), fc.string({ minLength: 1 }), (index, label) => {
        const name = stemExportFilename(index, label)
        expect(name).toBe(`${String(index + 1).padStart(2, '0')}_${label}.wav`)
      })
    )
  })
})

describe('padChannels', () => {
  it('zero-pads every channel to the requested frame count', () => {
    const padded = padChannels([[1, -1]], 4)
    expect(Array.from(padded[0] ?? [])).toEqual([1, -1, 0, 0])
  })

  it('returns the same channel untouched when already the right length', () => {
    const channel = [0.5, -0.5]
    const padded = padChannels([channel], 2)
    expect(padded[0]).toBe(channel)
  })

  it('truncates a channel longer than the frame count', () => {
    const padded = padChannels([[1, -1, 1, -1]], 2)
    expect(Array.from(padded[0] ?? [])).toEqual([1, -1])
  })

  it('always yields channels of exactly `frames` samples, prefix preserved', () => {
    fc.assert(
      fc.property(
        fc.array(fc.array(fc.double({ min: -1, max: 1, noNaN: true }))),
        fc.nat(64),
        (channels, frames) => {
          const padded = padChannels(channels, frames)
          expect(padded).toHaveLength(channels.length)
          for (const [i, channel] of padded.entries()) {
            expect(channel.length).toBe(frames)
            const source = channels[i] ?? []
            for (let s = 0; s < frames; s++) {
              expect(channel[s]).toBe(s < source.length ? source[s] : 0)
            }
          }
        }
      )
    )
  })
})
