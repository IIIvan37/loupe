import { followScrollLeft } from './follow-scroll.ts'

describe('followScrollLeft', () => {
  it('keeps the page still while the playhead is inside the visible window', () => {
    expect(
      followScrollLeft({
        playheadX: 150,
        scrollLeft: 100,
        clientWidth: 200,
        scrollWidth: 1000
      })
    ).toBeNull()
  })

  it('flips the page so the playhead lands at the left edge when it crosses the right edge', () => {
    expect(
      followScrollLeft({
        playheadX: 320,
        scrollLeft: 100,
        clientWidth: 200,
        scrollWidth: 1000
      })
    ).toBe(320)
  })

  it('flips the page back when the playhead seeks before the left edge', () => {
    expect(
      followScrollLeft({
        playheadX: 40,
        scrollLeft: 100,
        clientWidth: 200,
        scrollWidth: 1000
      })
    ).toBe(40)
  })

  it('flips the page when the playhead sits exactly on the right edge', () => {
    expect(
      followScrollLeft({
        playheadX: 300,
        scrollLeft: 100,
        clientWidth: 200,
        scrollWidth: 1000
      })
    ).toBe(300)
  })

  it('never scrolls to a negative offset when the window is wider than the content', () => {
    expect(
      followScrollLeft({
        playheadX: 40,
        scrollLeft: 100,
        clientWidth: 300,
        scrollWidth: 250
      })
    ).toBe(0)
  })

  it('clamps the last page to the end of the timeline', () => {
    expect(
      followScrollLeft({
        playheadX: 950,
        scrollLeft: 100,
        clientWidth: 200,
        scrollWidth: 1000
      })
    ).toBe(800)
  })
})
