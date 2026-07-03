// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import type { MarkerList } from '@app/core'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, vi } from 'vitest'
import { I18nTestingProvider } from '../../i18n/i18n-testing-provider.tsx'
import { i18n } from '../../i18n/i18n.ts'
import { MarkerRail } from './marker-rail.tsx'

const markers: MarkerList = [
  { id: 'a', timeSeconds: 5, label: 'Repère 1' }
]

const noop = () => {}

beforeAll(() => {
  // jsdom implements neither pointer capture method; the rail calls both.
  Element.prototype.setPointerCapture = vi.fn()
  Element.prototype.releasePointerCapture = vi.fn()
})

function renderRail(overrides: Partial<Parameters<typeof MarkerRail>[0]> = {}) {
  const view = render(
    <MarkerRail
      markers={markers}
      durationSeconds={10}
      onSeek={noop}
      onMove={noop}
      {...overrides}
    />,
    { wrapper: I18nTestingProvider }
  )
  // Ratios are measured against the timeline root (the rail's container).
  const timeline = view.container.firstElementChild as HTMLElement
  timeline.getBoundingClientRect = () => ({ left: 0, width: 100 }) as DOMRect
  const tag = screen.getByRole('button', {
    name: i18n._('markers.go-to', { name: 'Repère 1' })
  })
  return { ...view, tag }
}

describe('MarkerRail', () => {
  it('seeks to a marker when its tag is clicked', async () => {
    const user = userEvent.setup()
    const onSeek = vi.fn()
    renderRail({ onSeek })
    await user.click(
      screen.getByRole('button', {
        name: i18n._('markers.go-to', { name: 'Repère 1' })
      })
    )
    expect(onSeek).toHaveBeenCalledWith(5)
  })

  it('renders nothing until a duration is known', () => {
    render(
      <MarkerRail
        markers={markers}
        durationSeconds={0}
        onSeek={noop}
        onMove={noop}
      />,
      { wrapper: I18nTestingProvider }
    )
    expect(
      screen.queryByRole('button', {
        name: i18n._('markers.go-to', { name: 'Repère 1' })
      })
    ).not.toBeInTheDocument()
  })

  it('moves a marker to the time where its tag is dropped', () => {
    const onMove = vi.fn()
    const { tag } = renderRail({ onMove })
    fireEvent.pointerDown(tag, { button: 0, clientX: 50, pointerId: 1 })
    fireEvent.pointerMove(tag, { clientX: 80 })
    fireEvent.pointerUp(tag, { clientX: 80 })
    expect(onMove).toHaveBeenCalledWith('a', 8)
  })

  it('does not seek after a real drag', () => {
    const onSeek = vi.fn()
    const { tag } = renderRail({ onSeek })
    fireEvent.pointerDown(tag, { button: 0, clientX: 50, pointerId: 1 })
    fireEvent.pointerMove(tag, { clientX: 80 })
    fireEvent.pointerUp(tag, { clientX: 80 })
    expect(onSeek).not.toHaveBeenCalled()
  })

  it('treats a motionless press as a seek, not a move', () => {
    const onMove = vi.fn()
    const { tag } = renderRail({ onMove })
    fireEvent.pointerDown(tag, { button: 0, clientX: 50, pointerId: 1 })
    fireEvent.pointerUp(tag, { clientX: 50 })
    expect(onMove).not.toHaveBeenCalled()
  })

  it('nudges a marker later with the right arrow key', () => {
    const onMove = vi.fn()
    const { tag } = renderRail({ onMove })
    fireEvent.keyDown(tag, { key: 'ArrowRight' })
    expect(onMove).toHaveBeenCalledWith('a', expect.closeTo(5.1))
  })

  it('nudges a marker earlier with the left arrow key', () => {
    const onMove = vi.fn()
    const { tag } = renderRail({ onMove })
    fireEvent.keyDown(tag, { key: 'ArrowLeft' })
    expect(onMove).toHaveBeenCalledWith('a', expect.closeTo(4.9))
  })

  it('clamps a drag to the end of the track', () => {
    const onMove = vi.fn()
    const { tag } = renderRail({ onMove })
    fireEvent.pointerDown(tag, { button: 0, clientX: 50, pointerId: 1 })
    fireEvent.pointerMove(tag, { clientX: 500 })
    fireEvent.pointerUp(tag, { clientX: 500 })
    expect(onMove).toHaveBeenCalledWith('a', 10)
  })
})
