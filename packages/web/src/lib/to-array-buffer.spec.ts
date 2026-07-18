import { describe, expect, it } from 'vitest'
import { toArrayBuffer } from './to-array-buffer.ts'

describe('toArrayBuffer', () => {
  it('returns the backing buffer when the view spans it whole', () => {
    const bytes = new Uint8Array([1, 2, 3])
    expect(toArrayBuffer(bytes)).toBe(bytes.buffer)
  })

  it('copies out just the view when it is a window into a larger buffer', () => {
    const backing = new Uint8Array([9, 1, 2, 3, 9]).buffer
    const view = new Uint8Array(backing, 1, 3)

    const out = toArrayBuffer(view)

    expect(out).not.toBe(backing)
    expect([...new Uint8Array(out)]).toEqual([1, 2, 3])
  })
})
