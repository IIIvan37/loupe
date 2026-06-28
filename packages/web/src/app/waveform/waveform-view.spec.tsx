// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { initialViewport, type Track, type Viewport, zoomTo } from '@app/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { WaveformView } from './waveform-view.tsx'

const track: Track = {
  sampleRate: 4,
  durationSeconds: 1,
  waveform: { peaks: [{ min: -1, max: 1 }] }
}

const noop = () => {}

function renderLoaded(
  overrides: Partial<Parameters<typeof WaveformView>[0]> = {}
) {
  return render(
    <WaveformView
      state={{ status: 'loaded', track }}
      positionRatio={0}
      loopRegion={undefined}
      durationSeconds={10}
      viewport={initialViewport()}
      onSeek={noop}
      onSelectRegion={noop}
      onScrollBy={noop}
      {...overrides}
    />
  )
}

/** A press-and-release at the same x is a click; a span is a drag. */
function pressDrag(element: Element, fromX: number, toX: number): void {
  element.getBoundingClientRect = () => ({ left: 0, width: 100 }) as DOMRect
  fireEvent.pointerDown(element, { button: 0, clientX: fromX })
  fireEvent.pointerUp(element, { button: 0, clientX: toX })
}

describe('WaveformView', () => {
  it('prompts for an import while idle', () => {
    render(
      <WaveformView
        state={{ status: 'idle' }}
        positionRatio={0}
        loopRegion={undefined}
        durationSeconds={0}
        viewport={initialViewport()}
        onSeek={noop}
        onSelectRegion={noop}
        onScrollBy={noop}
      />
    )
    expect(screen.getByText(/Importe un fichier audio/)).toBeInTheDocument()
  })

  it('seeks on a click (no drag)', () => {
    const onSeek = vi.fn()
    renderLoaded({ onSeek })
    pressDrag(screen.getByRole('button'), 30, 30)
    expect(onSeek).toHaveBeenCalledWith(0.3)
  })

  it('selects an A/B region on a drag', () => {
    const onSelectRegion = vi.fn()
    renderLoaded({ onSelectRegion })
    pressDrag(screen.getByRole('button'), 20, 60)
    expect(onSelectRegion).toHaveBeenCalledWith(0.2, 0.6)
  })

  it('normalises a backwards drag', () => {
    const onSelectRegion = vi.fn()
    renderLoaded({ onSelectRegion })
    pressDrag(screen.getByRole('button'), 60, 20)
    expect(onSelectRegion).toHaveBeenCalledWith(0.2, 0.6)
  })

  it('renders the waveform image once loaded', () => {
    renderLoaded()
    expect(
      screen.getByRole('img', { name: "Forme d'onde de la piste" })
    ).toBeInTheDocument()
  })

  it('maps a click through the zoom/scroll window to a timeline ratio', () => {
    // Zoom 2× anchored at the left shows [0, 0.5]; a click at the surface centre
    // is the quarter mark of the whole timeline.
    const onSeek = vi.fn()
    const viewport: Viewport = zoomTo(initialViewport(), 2, 0)
    renderLoaded({ onSeek, viewport })
    pressDrag(screen.getByRole('button'), 50, 50)
    expect(onSeek).toHaveBeenCalledWith(0.25)
  })

  it('pans the window on a horizontal wheel', () => {
    const onScrollBy = vi.fn()
    const viewport: Viewport = zoomTo(initialViewport(), 2, 0)
    renderLoaded({ onScrollBy, viewport })
    const stage = screen.getByRole('button')
    stage.getBoundingClientRect = () => ({ left: 0, width: 100 }) as DOMRect
    fireEvent.wheel(stage, { deltaX: 50, deltaY: 0 })
    // 50px over a 100px-wide 2×-zoom surface scrolls 0.25 of the timeline.
    expect(onScrollBy).toHaveBeenCalledWith(0.25)
  })

  it('hides the playhead when it sits outside the visible window', () => {
    // Zoom 2× anchored left shows [0, 0.5]; a playhead at 0.9 is off screen.
    const viewport: Viewport = zoomTo(initialViewport(), 2, 0)
    const { container } = renderLoaded({ viewport, positionRatio: 0.9 })
    expect(container.querySelector('[class*="playhead"]')).toBeNull()
  })
})
