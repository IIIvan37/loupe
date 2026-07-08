// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import type { LoopRegion, Track } from '@app/core'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, vi } from 'vitest'

import { I18nTestingProvider } from '../../i18n/i18n-testing-provider.tsx'
import { i18n } from '../../i18n/i18n.ts'
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
      beatGrid={[]}
      mixWaveform={undefined}
      durationSeconds={10}
      onSeek={noop}
      onSelectRegion={noop}
      onAdjustRegion={noop}
      onReimport={noop}
      {...overrides}
    />,
    { wrapper: I18nTestingProvider }
  )
  // Ratios are measured against the positioning container (the surface's parent).
  const surface = screen.getByRole('button', { name: i18n._('waveform.surface') })
  const container = surface.parentElement as HTMLElement
  container.getBoundingClientRect = () => ({ left: 0, width: 100 }) as DOMRect
  return { ...view, surface, container }
}

function renderError(onReimport: () => void = noop) {
  render(
    <WaveformView
      state={{ status: 'error', message: 'EncodingError: bad bytes' }}
      loopRegion={undefined}
      loopEnabled
      beatGrid={[]}
      mixWaveform={undefined}
      durationSeconds={0}
      onSeek={noop}
      onSelectRegion={noop}
      onAdjustRegion={noop}
      onReimport={onReimport}
    />,
    { wrapper: I18nTestingProvider }
  )
}

describe('WaveformView', () => {
  it('prompts for an import while idle', () => {
    render(
      <WaveformView
        state={{ status: 'idle' }}
        loopRegion={undefined}
        loopEnabled
        beatGrid={[]}
        mixWaveform={undefined}
        durationSeconds={0}
        onSeek={noop}
        onSelectRegion={noop}
        onAdjustRegion={noop}
        onReimport={noop}
      />,
      { wrapper: I18nTestingProvider }
    )
    expect(
      screen.getByText(i18n._('waveform.import-hint'))
    ).toBeInTheDocument()
  })

  it('explains an import failure in plain words', () => {
    renderError()
    expect(
      screen.getByText(i18n._('waveform.import-error'))
    ).toBeInTheDocument()
  })

  it('offers to import another file from the error stage', async () => {
    const user = userEvent.setup()
    const onReimport = vi.fn()
    renderError(onReimport)
    await user.click(
      screen.getByRole('button', { name: i18n._('waveform.reimport') })
    )
    expect(onReimport).toHaveBeenCalled()
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
      screen.queryByRole('button', {
        name: i18n._('waveform.move-loop-start')
      })
    ).not.toBeInTheDocument()

    const loopRegion: LoopRegion = { startSeconds: 2, endSeconds: 8 }
    rerender(
      <WaveformView
        state={{ status: 'loaded', track }}
        loopRegion={loopRegion}
        loopEnabled
        beatGrid={[]}
        mixWaveform={undefined}
        durationSeconds={10}
        onSeek={noop}
        onSelectRegion={noop}
        onAdjustRegion={noop}
        onReimport={noop}
      />
    )
    expect(
      screen.getByRole('button', {
        name: i18n._('waveform.move-loop-start')
      })
    ).toBeInTheDocument()
  })

  it('draws a line per detected beat, flagging downbeats', () => {
    const { container } = renderLoaded({
      beatGrid: [
        { timeSeconds: 0, downbeat: true },
        { timeSeconds: 0.5, downbeat: false },
        { timeSeconds: 1, downbeat: false }
      ]
    })
    expect(container.querySelectorAll('[data-beat]')).toHaveLength(3)
    expect(container.querySelectorAll('[data-beat="downbeat"]')).toHaveLength(1)
  })

  it('draws no beat lines when the grid is empty', () => {
    const { container } = renderLoaded({ beatGrid: [] })
    expect(container.querySelectorAll('[data-beat]')).toHaveLength(0)
  })

  it('adjusts the loop end by dragging its handle', () => {
    const onAdjustRegion = vi.fn()
    const { container } = renderLoaded({
      loopRegion: { startSeconds: 2, endSeconds: 8 },
      onAdjustRegion
    })
    const endHandle = screen.getByRole('button', {
      name: i18n._('waveform.move-loop-end')
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
      name: i18n._('waveform.move-loop-start')
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
      screen.getByRole('img', { name: i18n._('waveform.track-image') })
    ).toBeInTheDocument()
  })

  it('draws a single mix envelope when given a combined mix waveform', () => {
    renderLoaded({ mixWaveform: { peaks: [{ min: -0.5, max: 0.5 }] } })
    // The one summed mix envelope replaces the un-separated track envelope;
    // the individual stems live in their own lanes, not overlaid here.
    expect(
      screen.queryByRole('img', { name: i18n._('waveform.track-image') })
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('img', { name: i18n._('waveform.mix-image') })
    ).toBeInTheDocument()
  })
})
