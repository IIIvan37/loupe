import { describe, expect, it } from 'vitest'
import { mixWindow } from './mix-window.ts'

describe('mixWindow', () => {
  it('averages the channels of a layer over the window', () => {
    const layer = {
      channels: [
        new Float32Array([1, 1, 1, 1]),
        new Float32Array([0, 0, 0, 0])
      ],
      gain: 1
    }
    expect(Array.from(mixWindow([layer], 0, 4))).toEqual([0.5, 0.5, 0.5, 0.5])
  })

  it('starts the window at the requested frame', () => {
    const layer = { channels: [new Float32Array([1, 2, 3, 4])], gain: 1 }
    expect(Array.from(mixWindow([layer], 2, 2))).toEqual([3, 4])
  })

  it('zero-pads past the end of the audio — a window at the tail stays valid', () => {
    const layer = { channels: [new Float32Array([1, 2])], gain: 1 }
    expect(Array.from(mixWindow([layer], 1, 4))).toEqual([2, 0, 0, 0])
  })

  it('weights each layer by its gain — a muted stem is silent', () => {
    const loud = { channels: [new Float32Array([1, 1])], gain: 0.5 }
    const muted = { channels: [new Float32Array([1, 1])], gain: 0 }
    expect(Array.from(mixWindow([loud, muted], 0, 2))).toEqual([0.5, 0.5])
  })

  it('sums the layers — the paused mix is what the tap would hear', () => {
    const a = { channels: [new Float32Array([0.25, 0.25])], gain: 1 }
    const b = { channels: [new Float32Array([0.5, 0.5])], gain: 1 }
    expect(Array.from(mixWindow([a, b], 0, 2))).toEqual([0.75, 0.75])
  })

  it('a start before frame 0 clamps to the head', () => {
    const layer = { channels: [new Float32Array([1, 2, 3, 4])], gain: 1 }
    expect(Array.from(mixWindow([layer], -3, 2))).toEqual([1, 2])
  })

  it('no layers yields silence', () => {
    expect(Array.from(mixWindow([], 0, 3))).toEqual([0, 0, 0])
  })
})
