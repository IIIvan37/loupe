import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { decodeWav } from './wav-decoder.ts'
import { encodeWav } from './wav-encoder.ts'

describe('decodeWav', () => {
  it('reads the sample rate and channel count from the header', () => {
    const bytes = encodeWav([[0], [0]], 44100)
    const decoded = decodeWav(bytes.buffer)
    expect(decoded.sampleRate).toBe(44100)
    expect(decoded.channels).toHaveLength(2)
  })

  it('de-interleaves channels frame by frame', () => {
    // Stereo, one frame: L = 1 (→ 32767), R = -1 (→ -32768).
    const bytes = encodeWav([[1], [-1]], 44100)
    const decoded = decodeWav(bytes.buffer)
    expect(decoded.channels[0]?.[0]).toBeCloseTo(1, 4)
    expect(decoded.channels[1]?.[0]).toBeCloseTo(-1, 4)
  })

  it('rejects a stream too short for a RIFF header', () => {
    expect(() => decodeWav(new Uint8Array(10).buffer)).toThrow(/short/)
  })

  it('rejects a stream that is not a PCM WAV', () => {
    const notWav = new Uint8Array(44).buffer
    expect(() => decodeWav(notWav)).toThrow(/WAV|RIFF/)
  })

  it('rejects a header missing either the RIFF or the WAVE tag', () => {
    // A valid header with exactly one tag corrupted must still be rejected —
    // both tags are required, not just one.
    const riffOnly = encodeWav([[0]], 44100)
    riffOnly[8] = 0 // break 'WAVE'
    expect(() => decodeWav(riffOnly.buffer)).toThrow(/WAV|RIFF/)

    const waveOnly = encodeWav([[0]], 44100)
    waveOnly[0] = 0 // break 'RIFF'
    expect(() => decodeWav(waveOnly.buffer)).toThrow(/WAV|RIFF/)
  })

  it('rejects a header that declares zero channels', () => {
    const bytes = encodeWav([[0]], 44100)
    new DataView(bytes.buffer).setUint16(22, 0, true) // numChannels = 0
    expect(() => decodeWav(bytes.buffer)).toThrow(/channel/)
  })

  it('scales the int16 extremes back to exactly ±1 (full-scale both ways)', () => {
    // Pins fromInt16's two branches: -1 → -32768/0x8000, +1 → 32767/0x7fff.
    // A single divisor for both signs would miss one of these exact values.
    const decoded = decodeWav(encodeWav([[1, -1, 0]], 44100).buffer)
    expect(decoded.channels[0]?.[0]).toBe(1)
    expect(decoded.channels[0]?.[1]).toBe(-1)
    expect(decoded.channels[0]?.[2]).toBe(0)
  })

  // Property: encode → decode round-trips PCM within the 16-bit quantisation step.
  it('round-trips encodeWav within the quantisation step', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 4 }),
        fc.array(fc.float({ min: -1, max: 1, noNaN: true }), { minLength: 1 }),
        (channelCount, samples) => {
          const channels = Array.from({ length: channelCount }, () => samples)
          const decoded = decodeWav(encodeWav(channels, 44100).buffer)
          expect(decoded.sampleRate).toBe(44100)
          expect(decoded.channels).toHaveLength(channelCount)
          decoded.channels.forEach((channel) => {
            samples.forEach((sample, i) => {
              expect(channel[i]).toBeCloseTo(sample, 4)
            })
          })
        }
      )
    )
  })
})
