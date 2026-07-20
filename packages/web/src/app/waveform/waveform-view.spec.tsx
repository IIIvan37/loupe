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
  const surface = screen.getByTestId('waveform-surface')
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

  it('keeps the gesture surface out of the tab order (pointer-only, no lying button)', () => {
    const { surface } = renderLoaded()
    // A <button> promised an Enter action it never had; the drag/click gesture
    // is pointer-only and documented in the « ? » help instead.
    expect(surface.tagName).toBe('DIV')
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
    expect(onSelectRegion).toHaveBeenCalledWith(0.2, 0.6, true)
  })

  it('asks for no snapping when Alt is held at drag end', () => {
    const onSelectRegion = vi.fn()
    const { surface, container } = renderLoaded({ onSelectRegion })
    fireEvent.pointerDown(surface, { button: 0, clientX: 20 })
    fireEvent.pointerUp(container, { button: 0, clientX: 60, altKey: true })
    expect(onSelectRegion).toHaveBeenCalledWith(0.2, 0.6, false)
  })

  it('flashes the beat lines the edges snap to at a snapping drag end', () => {
    const { surface, container } = renderLoaded({
      // A beat per second across the 10 s timeline.
      beatGrid: [0, 1, 2, 3, 4, 5, 6, 7, 8].map((timeSeconds) => ({
        timeSeconds,
        downbeat: timeSeconds % 4 === 0
      }))
    })
    // 2.3 s → 2 s and 5.7 s → 6 s: two edges land on beats.
    fireEvent.pointerDown(surface, { button: 0, clientX: 23 })
    fireEvent.pointerUp(container, { button: 0, clientX: 57 })
    expect(screen.getAllByTestId('snap-flash')).toHaveLength(2)
  })

  it('does not flash when Alt escapes the snap', () => {
    const { surface, container } = renderLoaded({
      beatGrid: [0, 1, 2, 3, 4, 5, 6, 7, 8].map((timeSeconds) => ({
        timeSeconds,
        downbeat: timeSeconds % 4 === 0
      }))
    })
    fireEvent.pointerDown(surface, { button: 0, clientX: 23 })
    fireEvent.pointerUp(container, { button: 0, clientX: 57, altKey: true })
    expect(screen.queryByTestId('snap-flash')).not.toBeInTheDocument()
  })

  it('does not flash a snapping drag when there is no grid', () => {
    const { surface, container } = renderLoaded({ beatGrid: [] })
    fireEvent.pointerDown(surface, { button: 0, clientX: 23 })
    fireEvent.pointerUp(container, { button: 0, clientX: 57 })
    expect(screen.queryByTestId('snap-flash')).not.toBeInTheDocument()
  })

  it('normalises a backwards drag', () => {
    const onSelectRegion = vi.fn()
    const { surface, container } = renderLoaded({ onSelectRegion })
    fireEvent.pointerDown(surface, { button: 0, clientX: 60 })
    fireEvent.pointerUp(container, { button: 0, clientX: 20 })
    expect(onSelectRegion).toHaveBeenCalledWith(0.2, 0.6, true)
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
    expect(onAdjustRegion).toHaveBeenLastCalledWith(0.2, 0.5, true)
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

  it('nudges a loop edge to the next beat when a grid exists', () => {
    const onAdjustRegion = vi.fn()
    renderLoaded({
      loopRegion: { startSeconds: 2, endSeconds: 8 },
      // Beats every 0.5 s around the loop start at 2 s.
      beatGrid: [1.5, 2, 2.5, 4].map((timeSeconds) => ({
        timeSeconds,
        downbeat: timeSeconds === 4
      })),
      onAdjustRegion
    })
    const startHandle = screen.getByRole('button', {
      name: i18n._('waveform.move-loop-start')
    })
    fireEvent.keyDown(startHandle, { key: 'ArrowRight' })
    // 2 s → next beat 2.5 s → ratio 0.25 on the 10 s timeline.
    expect(onAdjustRegion).toHaveBeenCalledWith(0.25, 0.8, false)
  })

  it('nudges a loop edge a whole bar with Shift', () => {
    const onAdjustRegion = vi.fn()
    renderLoaded({
      loopRegion: { startSeconds: 2, endSeconds: 8 },
      beatGrid: [1.5, 2, 2.5, 4].map((timeSeconds) => ({
        timeSeconds,
        downbeat: timeSeconds === 4
      })),
      onAdjustRegion
    })
    const startHandle = screen.getByRole('button', {
      name: i18n._('waveform.move-loop-start')
    })
    fireEvent.keyDown(startHandle, { key: 'ArrowRight', shiftKey: true })
    expect(onAdjustRegion).toHaveBeenCalledWith(0.4, 0.8, false)
  })

  it('floats the edge timecode while dragging a handle, then clears it', () => {
    const { container } = renderLoaded({
      loopRegion: { startSeconds: 2, endSeconds: 8 }
    })
    const endHandle = screen.getByRole('button', {
      name: i18n._('waveform.move-loop-end')
    })
    fireEvent.pointerDown(endHandle, { button: 0, clientX: 80 })
    fireEvent.pointerMove(endHandle, { clientX: 50 })
    // clientX 50 on the 100 px surface → ratio 0.5 → 5 s on the 10 s timeline.
    expect(screen.getByTestId('loop-edge-label')).toHaveTextContent('0:05')
    fireEvent.pointerUp(container, { button: 0, clientX: 50 })
    expect(screen.queryByTestId('loop-edge-label')).not.toBeInTheDocument()
  })

  it('floats the focused edge timecode for keyboard nudging, cleared on blur', () => {
    renderLoaded({ loopRegion: { startSeconds: 2, endSeconds: 8 } })
    const startHandle = screen.getByRole('button', {
      name: i18n._('waveform.move-loop-start')
    })
    fireEvent.focus(startHandle)
    // start 2 s → 0:02; the label rides the handle while it holds focus.
    expect(screen.getByTestId('loop-edge-label')).toHaveTextContent('0:02')
    fireEvent.blur(startHandle)
    expect(screen.queryByTestId('loop-edge-label')).not.toBeInTheDocument()
  })

  it('marks the hovered timecode under the pointer', () => {
    const { container } = renderLoaded()
    fireEvent.pointerMove(container, { clientX: 50 })
    expect(screen.getByTestId('waveform-hover-label')).toHaveTextContent('0:05')
    fireEvent.pointerLeave(container)
    expect(screen.queryByTestId('waveform-hover-label')).not.toBeInTheDocument()
  })

  it('drops the hover marker during a selection drag', () => {
    const { surface, container } = renderLoaded()
    fireEvent.pointerDown(surface, { button: 0, clientX: 20 })
    fireEvent.pointerMove(container, { clientX: 60 })
    expect(screen.queryByTestId('waveform-hover-label')).not.toBeInTheDocument()
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
