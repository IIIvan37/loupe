import { describe, expect, it } from 'vitest'
import { followScrollTop } from './follow-scroll-top.ts'

// The scrollport is 100px tall showing a 400px sheet; measures are 40px rows.
const viewport = { scrollTop: 100, clientHeight: 100, scrollHeight: 400 }

describe('followScrollTop', () => {
  it('leaves the scroll alone while the measure is fully visible', () => {
    expect(
      followScrollTop({ ...viewport, measureTop: 120, measureBottom: 160 })
    ).toBeNull()
  })

  it('treats a measure flush with the edges as visible', () => {
    expect(
      followScrollTop({ ...viewport, measureTop: 100, measureBottom: 200 })
    ).toBeNull()
  })

  it('scrolls up just enough when the measure sits above the viewport', () => {
    expect(
      followScrollTop({ ...viewport, measureTop: 40, measureBottom: 80 })
    ).toBe(40)
  })

  it('scrolls down just enough when the measure sits below the viewport', () => {
    expect(
      followScrollTop({ ...viewport, measureTop: 240, measureBottom: 280 })
    ).toBe(180)
  })

  it('aligns a partially clipped measure to the nearest edge', () => {
    // Clipped at the top → align its top; clipped at the bottom → its bottom.
    expect(
      followScrollTop({ ...viewport, measureTop: 90, measureBottom: 130 })
    ).toBe(90)
    expect(
      followScrollTop({ ...viewport, measureTop: 180, measureBottom: 220 })
    ).toBe(120)
  })

  it('never scrolls past the sheet edges', () => {
    expect(
      followScrollTop({ ...viewport, measureTop: -20, measureBottom: 20 })
    ).toBe(0)
    expect(
      followScrollTop({ ...viewport, measureTop: 380, measureBottom: 420 })
    ).toBe(300)
  })

  it('pins a measure taller than the viewport to its top', () => {
    // `nearest` on an oversized target shows its start, not its end.
    expect(
      followScrollTop({ ...viewport, measureTop: 240, measureBottom: 390 })
    ).toBe(240)
  })
})
