// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { act } from 'react'
import { createExternalValue } from '../../lib/external-value.ts'
import { ZoomStage } from './zoom-stage.tsx'

/** jsdom has no layout: pin the geometry the follow logic reads. */
function mockGeometry(scroll: Element) {
  Object.defineProperty(scroll, 'scrollWidth', {
    value: 1000,
    configurable: true
  })
  Object.defineProperty(scroll, 'clientWidth', {
    value: 250,
    configurable: true
  })
}

function renderStage(
  overrides: Partial<Parameters<typeof ZoomStage>[0]> = {}
) {
  return render(
    <ZoomStage
      zoom={1}
      position={createExternalValue(0)}
      durationSeconds={10}
      {...overrides}
    >
      <div data-testid="layer">ruler + waveform</div>
    </ZoomStage>
  )
}

describe('ZoomStage', () => {
  it('renders its aligned layers', () => {
    renderStage({ zoom: 2 })
    expect(screen.getByTestId('layer')).toBeInTheDocument()
  })

  it('widens the inner so every layer scales with the zoom', () => {
    const { container } = renderStage({ zoom: 3 })
    const inner = container.querySelector('[class*="inner"]')
    expect(inner).toHaveStyle({ width: '300%' })
  })

  it('positions the playhead at its fraction of the timeline', () => {
    // V.4: the playhead moves by transform only (compositor), never `left` —
    // pixels are the ratio applied to the stage's scrollWidth.
    const position = createExternalValue(0)
    const { container } = renderStage({ position })
    mockGeometry(container.querySelector('[class*="scroll"]') as Element)
    act(() => position.set(4))
    const playhead = container.querySelector('[class*="playhead"]')
    expect(playhead).toHaveStyle({ transform: 'translateX(400px)' })
  })

  it('moves the playhead on a streamed position without re-rendering', () => {
    // Lot L.1: the playhead is driven imperatively off the position store —
    // a frame tick touches this one DOM node, not the React tree.
    const position = createExternalValue(0)
    const { container } = renderStage({ position })
    mockGeometry(container.querySelector('[class*="scroll"]') as Element)
    act(() => position.set(2.5))
    const playhead = container.querySelector('[class*="playhead"]')
    expect(playhead).toHaveStyle({ transform: 'translateX(250px)' })
  })

  it('re-applies the playhead when the stage resizes without a position tick', () => {
    // A window resize rewidens the stage while paused: with pixel transforms
    // the playhead must be recomputed by the ResizeObserver, not left stale.
    const observers: Array<() => void> = []
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          observers.push(callback)
        }
        observe() {}
        disconnect() {}
      }
    )
    try {
      const position = createExternalValue(5)
      const { container } = renderStage({ position })
      const scroll = container.querySelector('[class*="scroll"]') as Element
      mockGeometry(scroll)
      act(() => {
        for (const notify of observers) {
          notify()
        }
      })
      const playhead = container.querySelector('[class*="playhead"]')
      expect(playhead).toHaveStyle({ transform: 'translateX(500px)' })
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('publishes the played fraction as a CSS variable for the split layers', () => {
    // AO.1: the played/upcoming colour split clips on --playhead-ratio — same
    // imperative apply as the playhead, zero React re-render per frame.
    const position = createExternalValue(0)
    const { container } = renderStage({ position })
    mockGeometry(container.querySelector('[class*="scroll"]') as Element)
    act(() => position.set(4))
    const inner = container.querySelector('[class*="inner"]') as HTMLElement
    expect(inner.style.getPropertyValue('--playhead-ratio')).toBe('0.4')
  })

  it('publishes a zero ratio before the first tick', () => {
    const { container } = renderStage()
    const inner = container.querySelector('[class*="inner"]') as HTMLElement
    expect(inner.style.getPropertyValue('--playhead-ratio')).toBe('0')
  })

  describe('page-follow (Lot L.2)', () => {
    function renderZoomedStage() {
      const position = createExternalValue(0)
      const { container } = renderStage({ zoom: 4, position })
      const scroll = container.querySelector('[class*="scroll"]') as HTMLElement
      mockGeometry(scroll)
      return { position, scroll }
    }

    it('leaves the scroll alone while the playhead stays inside the visible window', () => {
      const { position, scroll } = renderZoomedStage()
      act(() => position.set(2)) // playheadX 200 < clientWidth 250
      expect(scroll.scrollLeft).toBe(0)
    })

    it('flips the page when the playhead crosses the right edge', () => {
      const { position, scroll } = renderZoomedStage()
      act(() => position.set(4)) // playheadX 400 > 250 → new page at 400
      expect(scroll.scrollLeft).toBe(400)
    })

    it('suspends the follow after a manual scroll', () => {
      vi.useFakeTimers()
      const { position, scroll } = renderZoomedStage()
      scroll.scrollLeft = 600
      fireEvent.scroll(scroll)
      act(() => position.set(4)) // out of view, but the user just scrolled
      expect(scroll.scrollLeft).toBe(600)
      vi.useRealTimers()
    })

    it('resumes the follow once the manual-scroll grace period has elapsed', () => {
      vi.useFakeTimers()
      const { position, scroll } = renderZoomedStage()
      scroll.scrollLeft = 600
      fireEvent.scroll(scroll)
      act(() => vi.advanceTimersByTime(2100))
      act(() => position.set(4))
      expect(scroll.scrollLeft).toBe(400)
      vi.useRealTimers()
    })
  })
})
