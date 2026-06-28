// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import type { MarkerList } from '@app/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { AnalysisPanel } from './analysis-panel.tsx'

const markers: MarkerList = [
  { id: 'a', timeSeconds: 5, kind: 'beat', label: 'Temps 1' }
]

const noop = () => {}

describe('AnalysisPanel', () => {
  it('lists markers of every kind and seeks one', () => {
    const onSeekMarker = vi.fn()
    render(
      <AnalysisPanel
        markers={markers}
        onSeekMarker={onSeekMarker}
        onRemoveMarker={noop}
      />
    )
    // A beat marker has no rail tag, so the inspector is its only seek path.
    // The seek row carries the timecode; the remove button does not.
    fireEvent.click(screen.getByRole('button', { name: /0:05/ }))
    expect(onSeekMarker).toHaveBeenCalledWith(5)
  })

  it('removes a marker of any kind', () => {
    const onRemoveMarker = vi.fn()
    render(
      <AnalysisPanel
        markers={markers}
        onSeekMarker={noop}
        onRemoveMarker={onRemoveMarker}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer Temps 1' }))
    expect(onRemoveMarker).toHaveBeenCalledWith('a')
  })

  it('invites adding markers when there are none', () => {
    render(
      <AnalysisPanel markers={[]} onSeekMarker={noop} onRemoveMarker={noop} />
    )
    expect(screen.getByText(/Aucun repère/)).toBeInTheDocument()
  })
})
