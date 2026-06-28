// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import type { LoopRegion, Track } from '@app/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeAll, vi } from 'vitest'

import { WaveformView } from './waveform-view.tsx'

const track: Track = {
  sampleRate: 4,
  durationSeconds: 1,
  waveform: { peaks: [{ min: -1, max: 1 }] }
}

const noop = () => {}

beforeAll(() => {
  // jsdom implements neither pointer capture method; the view calls both.
  Element.prototype.setPointerCapture = vi.fn()
  Element.prototype.releasePointerCapture = vi.fn()
})

function renderLoaded(
  overrides: Partial<Parameters<typeof WaveformView>[0]> = {}
) {
  const view = render(
    <WaveformView
      state={{ status: 'loaded', track }}
      loopRegion={undefined}
      loopEnabled
      durationSeconds={10}
      onSeek={noop}
      onSelectRegion={noop}
      onAdjustRegion={noop}
      {...overrides}
    />
  )
  // Ratios are measured against the positioning container (the surface's parent).
  const surface = screen.getByRole('button', { name: /Forme d'onde :/ })
  const container = surface.parentElement as HTMLElement
  container.getBoundingClientRect = () => ({ left: 0, width: 100 }) as DOMRect
  return { ...view, surface, container }
}

describe('WaveformView', () => {
  it('prompts for an import while idle', () => {
    render(
      <WaveformView
        state={{ status: 'idle' }}
        loopRegion={undefined}
        loopEnabled
        durationSeconds={0}
        onSeek={noop}
        onSelectRegion={noop}
        onAdjustRegion={noop}
      />
    )
    expect(screen.getByText(/Importe un fichier audio/)).toBeInTheDocument()
  })

  it('seeks on a click (no drag)', () => {
    const onSeek = vi.fn()
    const { surface, container } = renderLoaded({ onSeek })
    fireEvent.pointerDown(surface, { button: 0, clientX: 30 })
    fireEvent.pointerUp(container, { button: 0, clientX: 30 })
    expect(onSeek).toHaveBeenCalledWith(0.3)
  })

  it('selects an A/B region on a drag', () => {
    const onSelectRegion = vi.fn()
    const { surface, container } = renderLoaded({ onSelectRegion })
    fireEvent.pointerDown(surface, { button: 0, clientX: 20 })
    fireEvent.pointerUp(container, { button: 0, clientX: 60 })
    expect(onSelectRegion).toHaveBeenCalledWith(0.2, 0.6)
  })

  it('normalises a backwards drag', () => {
    const onSelectRegion = vi.fn()
    const { surface, container } = renderLoaded({ onSelectRegion })
    fireEvent.pointerDown(surface, { button: 0, clientX: 60 })
    fireEvent.pointerUp(container, { button: 0, clientX: 20 })
    expect(onSelectRegion).toHaveBeenCalledWith(0.2, 0.6)
  })

  it('shows the A/B edit handles only when a loop is active', () => {
    const { rerender } = renderLoaded()
    expect(
      screen.queryByRole('button', { name: 'Déplacer le début de la boucle' })
    ).not.toBeInTheDocument()

    const loopRegion: LoopRegion = { startSeconds: 2, endSeconds: 8 }
    rerender(
      <WaveformView
        state={{ status: 'loaded', track }}
        loopRegion={loopRegion}
        loopEnabled
        durationSeconds={10}
        onSeek={noop}
        onSelectRegion={noop}
        onAdjustRegion={noop}
      />
    )
    expect(
      screen.getByRole('button', { name: 'Déplacer le début de la boucle' })
    ).toBeInTheDocument()
  })

  it('adjusts the loop end by dragging its handle', () => {
    const onAdjustRegion = vi.fn()
    const { container } = renderLoaded({
      loopRegion: { startSeconds: 2, endSeconds: 8 },
      onAdjustRegion
    })
    const endHandle = screen.getByRole('button', {
      name: 'Déplacer la fin de la boucle'
    })
    fireEvent.pointerDown(endHandle, { button: 0, clientX: 80 })
    fireEvent.pointerMove(endHandle, { clientX: 50 })
    fireEvent.pointerUp(container, { button: 0, clientX: 50 })
    expect(onAdjustRegion).toHaveBeenLastCalledWith(0.2, 0.5)
  })

  it('nudges a loop edge with the arrow keys', () => {
    const onAdjustRegion = vi.fn()
    renderLoaded({
      loopRegion: { startSeconds: 2, endSeconds: 8 },
      onAdjustRegion
    })
    const startHandle = screen.getByRole('button', {
      name: 'Déplacer le début de la boucle'
    })
    fireEvent.keyDown(startHandle, { key: 'ArrowRight' })
    // start 0.2 + 0.01 nudge → 0.21, end unchanged at 0.8.
    const [start, end] = onAdjustRegion.mock.calls[0] ?? []
    expect(start).toBeCloseTo(0.21)
    expect(end).toBeCloseTo(0.8)
  })

  it('renders the waveform image once loaded', () => {
    renderLoaded()
    expect(
      screen.getByRole('img', { name: "Forme d'onde de la piste" })
    ).toBeInTheDocument()
  })
})
