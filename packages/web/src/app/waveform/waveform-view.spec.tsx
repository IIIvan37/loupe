// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import type { Track } from '@app/core'
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
      onSeek={noop}
      onSelectRegion={noop}
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
        onSeek={noop}
        onSelectRegion={noop}
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
})
