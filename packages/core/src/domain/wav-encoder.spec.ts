import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { encodeWav } from './wav-encoder.ts'

/** Read a 4-char ASCII tag from the byte stream. */
function ascii(bytes: Uint8Array, offset: number): string {
  return String.fromCharCode(...bytes.subarray(offset, offset + 4))
}

function int16At(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer).getInt16(offset, true)
}

describe('encodeWav', () => {
  it('writes a well-formed 16-bit PCM header', () => {
    const bytes = encodeWav([[0, 0]], 8000)
    const view = new DataView(bytes.buffer)
    expect(ascii(bytes, 0)).toBe('RIFF')
    expect(view.getUint32(4, true)).toBe(36 + 4) // RIFF size = 36 + data
    expect(ascii(bytes, 8)).toBe('WAVE')
    expect(ascii(bytes, 12)).toBe('fmt ')
    expect(view.getUint32(16, true)).toBe(16) // fmt chunk size
    expect(view.getUint16(20, true)).toBe(1) // PCM
    expect(view.getUint16(22, true)).toBe(1) // mono
    expect(view.getUint32(24, true)).toBe(8000) // sample rate
    expect(view.getUint32(28, true)).toBe(8000 * 2) // byte rate = rate × blockAlign
    expect(view.getUint16(32, true)).toBe(2) // block align = 1 ch × 2 bytes
    expect(view.getUint16(34, true)).toBe(16) // bits per sample
    expect(ascii(bytes, 36)).toBe('data')
    expect(view.getUint32(40, true)).toBe(4) // 2 frames × 1 ch × 2 bytes
  })

  it('scales full-scale samples to the int16 extremes', () => {
    const bytes = encodeWav([[1, -1, 0]], 8000)
    expect(int16At(bytes, 44)).toBe(32767)
    expect(int16At(bytes, 46)).toBe(-32768)
    expect(int16At(bytes, 48)).toBe(0)
  })

  it('clamps out-of-range samples', () => {
    const bytes = encodeWav([[2, -2]], 8000)
    expect(int16At(bytes, 44)).toBe(32767)
    expect(int16At(bytes, 46)).toBe(-32768)
  })

  it('interleaves channels frame by frame', () => {
    // Stereo, one frame: L = 1 (→ 32767), R = -1 (→ -32768).
    const bytes = encodeWav([[1], [-1]], 44100)
    const view = new DataView(bytes.buffer)
    expect(view.getUint16(22, true)).toBe(2) // stereo
    expect(view.getUint32(28, true)).toBe(44100 * 4) // byte rate
    expect(int16At(bytes, 44)).toBe(32767) // L
    expect(int16At(bytes, 46)).toBe(-32768) // R
  })

  it('rejects empty channels or a bad sample rate', () => {
    expect(() => encodeWav([], 44100)).toThrow(/channel/)
    expect(() => encodeWav([[0]], 0)).toThrow(/sample rate/)
    expect(() => encodeWav([[0]], 1.5)).toThrow(/sample rate/)
  })

  it('rejects channels of unequal length', () => {
    expect(() => encodeWav([[0, 0], [0]], 44100)).toThrow(/same length/)
  })

  // Property: byte length is the 44-byte header plus interleaved 16-bit samples.
  it('produces header + frames × channels × 2 bytes', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 4 }),
        fc.integer({ min: 0, max: 200 }),
        (channelCount, frames) => {
          const channels = Array.from(
            { length: channelCount },
            () => new Float32Array(frames)
          )
          expect(encodeWav(channels, 44100)).toHaveLength(
            44 + frames * channelCount * 2
          )
        }
      )
    )
  })

  // Property: a sample round-trips through int16 within the quantisation step.
  it('round-trips samples within the 16-bit quantisation step', () => {
    fc.assert(
      fc.property(
        fc.array(fc.float({ min: -1, max: 1, noNaN: true }), { minLength: 1 }),
        (samples) => {
          const bytes = encodeWav([samples], 44100)
          samples.forEach((sample, i) => {
            expect(int16At(bytes, 44 + i * 2) / 0x8000).toBeCloseTo(sample, 4)
          })
        }
      )
    )
  })
})
