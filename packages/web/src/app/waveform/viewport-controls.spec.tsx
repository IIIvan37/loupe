// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { initialViewport, type Viewport, zoomTo } from '@app/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { ViewportControls } from './viewport-controls.tsx'

const noop = () => {}

function renderControls(
  overrides: Partial<Parameters<typeof ViewportControls>[0]> = {}
) {
  return render(
    <ViewportControls
      viewport={initialViewport()}
      disabled={false}
      onZoomIn={noop}
      onZoomOut={noop}
      onScroll={noop}
      {...overrides}
    />
  )
}

describe('ViewportControls', () => {
  it('shows the current zoom level', () => {
    renderControls({ viewport: zoomTo(initialViewport(), 3, 0) })
    expect(screen.getByText('3×')).toBeInTheDocument()
  })

  it('zooms in and out', () => {
    const onZoomIn = vi.fn()
    const onZoomOut = vi.fn()
    renderControls({
      viewport: zoomTo(initialViewport(), 3, 0),
      onZoomIn,
      onZoomOut
    })
    fireEvent.click(screen.getByRole('button', { name: 'Zoomer' }))
    fireEvent.click(screen.getByRole('button', { name: 'Dézoomer' }))
    expect(onZoomIn).toHaveBeenCalled()
    expect(onZoomOut).toHaveBeenCalled()
  })

  it('cannot zoom out past 1×', () => {
    renderControls({ viewport: initialViewport() })
    expect(screen.getByRole('button', { name: 'Dézoomer' })).toBeDisabled()
  })

  it('cannot zoom in past the max', () => {
    renderControls({ viewport: zoomTo(initialViewport(), 6, 0) })
    expect(screen.getByRole('button', { name: 'Zoomer' })).toBeDisabled()
  })

  it('disables the scroll slider when nothing is off screen', () => {
    renderControls({ viewport: initialViewport() })
    expect(screen.getByRole('slider', { name: 'Défilement horizontal' })).toBeDisabled()
  })

  it('scrolls to an absolute offset scaled by the max offset', () => {
    const onScroll = vi.fn()
    // At 2× the max offset is 0.5; a half-way slider lands at 0.25.
    const viewport: Viewport = zoomTo(initialViewport(), 2, 0)
    renderControls({ viewport, onScroll })
    const slider = screen.getByRole('slider', { name: 'Défilement horizontal' })
    fireEvent.change(slider, { target: { value: '0.5' } })
    expect(onScroll).toHaveBeenCalledWith(0.25)
  })

  it('disables everything until a track is loaded', () => {
    renderControls({ viewport: zoomTo(initialViewport(), 3, 0), disabled: true })
    expect(screen.getByRole('button', { name: 'Zoomer' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Dézoomer' })).toBeDisabled()
    expect(screen.getByRole('slider', { name: 'Défilement horizontal' })).toBeDisabled()
  })
})
