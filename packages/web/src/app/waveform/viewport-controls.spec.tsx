// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { I18nTestingProvider } from '../../i18n/i18n-testing-provider.tsx'
import { i18n } from '../../i18n/i18n.ts'
import { ViewportControls } from './viewport-controls.tsx'

const noop = () => {}

function renderControls(
  overrides: Partial<Parameters<typeof ViewportControls>[0]> = {}
) {
  return render(
    <ViewportControls
      zoom={1}
      disabled={false}
      onZoomIn={noop}
      onZoomOut={noop}
      onSetZoom={noop}
      {...overrides}
    />,
    { wrapper: I18nTestingProvider }
  )
}

describe('ViewportControls', () => {
  it('shows the current zoom level (integer and half-step)', () => {
    renderControls({ zoom: 3 })
    expect(screen.getByText('3×')).toBeInTheDocument()
  })

  it('formats a half-step zoom to one decimal', () => {
    renderControls({ zoom: 2.5 })
    expect(screen.getByText('2.5×')).toBeInTheDocument()
  })

  it('zooms in and out', async () => {
    const user = userEvent.setup()
    const onZoomIn = vi.fn()
    const onZoomOut = vi.fn()
    renderControls({ zoom: 3, onZoomIn, onZoomOut })
    await user.click(
      screen.getByRole('button', { name: i18n._('waveform.zoom-in') })
    )
    await user.click(
      screen.getByRole('button', { name: i18n._('waveform.zoom-out') })
    )
    expect(onZoomIn).toHaveBeenCalled()
    expect(onZoomOut).toHaveBeenCalled()
  })

  it('cannot zoom out past 1×', () => {
    renderControls({ zoom: 1 })
    expect(
      screen.getByRole('button', { name: i18n._('waveform.zoom-out') })
    ).toBeDisabled()
  })

  it('cannot zoom in past 6×', () => {
    renderControls({ zoom: 6 })
    expect(
      screen.getByRole('button', { name: i18n._('waveform.zoom-in') })
    ).toBeDisabled()
  })

  it('sets an absolute zoom level from the slider', () => {
    const onSetZoom = vi.fn()
    renderControls({ onSetZoom })
    const slider = screen.getByRole('slider', {
      name: i18n._('waveform.zoom-slider')
    })
    // fireEvent kept: user-event cannot drive <input type="range">.
    fireEvent.change(slider, { target: { value: '4' } })
    expect(onSetZoom).toHaveBeenCalledWith(4)
  })

  it('disables every control until a track is loaded', () => {
    renderControls({ zoom: 3, disabled: true })
    expect(
      screen.getByRole('button', { name: i18n._('waveform.zoom-in') })
    ).toBeDisabled()
    expect(
      screen.getByRole('button', { name: i18n._('waveform.zoom-out') })
    ).toBeDisabled()
    expect(
      screen.getByRole('slider', { name: i18n._('waveform.zoom-slider') })
    ).toBeDisabled()
  })
})
