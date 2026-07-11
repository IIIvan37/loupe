// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { act } from 'react'
import { createExternalValue } from '../../lib/external-value.ts'
import { ZoomStage } from './zoom-stage.tsx'

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
    const { container } = renderStage({ position: createExternalValue(4) })
    const playhead = container.querySelector('[class*="playhead"]')
    expect(playhead).toHaveStyle({ left: '40%' })
  })

  it('moves the playhead on a streamed position without re-rendering', () => {
    // Lot L.1: the playhead is driven imperatively off the position store —
    // a frame tick touches this one DOM node, not the React tree.
    const position = createExternalValue(0)
    const { container } = renderStage({ position })
    act(() => position.set(2.5))
    const playhead = container.querySelector('[class*="playhead"]')
    expect(playhead).toHaveStyle({ left: '25%' })
  })
})
