import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { padChannels, stemExportFilename } from './stem-export.ts'

const UNSAFE_FILENAME_CHARS = /[/\\:*?"<>|]/

describe('stemExportFilename', () => {
  it('numbers the file from its display position', () => {
    expect(stemExportFilename(0, 'Voix')).toBe('01_Voix.wav')
  })

  it('pads the number to two digits', () => {
    expect(stemExportFilename(9, 'Batterie')).toBe('10_Batterie.wav')
  })

  it('makes a path-hostile label safe (a / would nest folders in the zip)', () => {
    expect(stemExportFilename(0, 'Guitare/Acoustique: "lead"?')).toBe(
      '01_Guitare-Acoustique- -lead--.wav'
    )
  })

  it('keeps a safe label verbatim for any position', () => {
    const safeLabel = fc
      .string({ minLength: 1 })
      .filter((label) => !UNSAFE_FILENAME_CHARS.test(label))
    fc.assert(
      fc.property(fc.nat(98), safeLabel, (index, label) => {
        const name = stemExportFilename(index, label)
        expect(name).toBe(`${String(index + 1).padStart(2, '0')}_${label}.wav`)
      })
    )
  })

  it('never emits a character a zip entry or filesystem rejects', () => {
    fc.assert(
      fc.property(fc.nat(98), fc.string(), (index, label) => {
        expect(stemExportFilename(index, label)).not.toMatch(
          UNSAFE_FILENAME_CHARS
        )
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

  it('refuses a frame count that would drop samples', () => {
    expect(() => padChannels([[1, -1, 1, -1]], 2)).toThrow()
  })

  it('always yields channels of exactly `frames` samples, prefix preserved', () => {
    fc.assert(
      fc.property(
        fc.array(fc.array(fc.double({ min: -1, max: 1, noNaN: true }))),
        fc.nat(16),
        (channels, extraFrames) => {
          const longest = Math.max(
            0,
            ...channels.map((channel) => channel.length)
          )
          const frames = longest + extraFrames
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
