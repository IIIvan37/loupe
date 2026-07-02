// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { ZoomStage } from './zoom-stage.tsx'

function renderStage(
  overrides: Partial<Parameters<typeof ZoomStage>[0]> = {}
) {
  return render(
    <ZoomStage zoom={1} positionRatio={0} {...overrides}>
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
    const { container } = renderStage({ positionRatio: 0.4 })
    const playhead = container.querySelector('[class*="playhead"]')
    expect(playhead).toHaveStyle({ left: '40%' })
  })
})
