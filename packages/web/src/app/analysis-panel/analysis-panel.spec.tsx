// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import type { MarkerList } from '@app/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { AnalysisPanel } from './analysis-panel.tsx'

const markers: MarkerList = [
  { id: 'a', timeSeconds: 5, label: 'Repère 1' }
]

const noop = () => {}

describe('AnalysisPanel', () => {
  it('lists markers of every kind and seeks one', () => {
    const onSeekMarker = vi.fn()
    render(
      <AnalysisPanel
        markers={markers}
        onSeekMarker={onSeekMarker}
        onRenameMarker={noop}
        onRemoveMarker={noop}
      />
    )
    // A beat marker has no rail tag, so the inspector is its only seek path.
    // The seek row carries the timecode; the remove button does not.
    fireEvent.click(screen.getByRole('button', { name: /0:05/ }))
    expect(onSeekMarker).toHaveBeenCalledWith(5)
  })

  it('renames a marker through the editor', () => {
    const onRenameMarker = vi.fn()
    render(
      <AnalysisPanel
        markers={markers}
        onSeekMarker={noop}
        onRenameMarker={onRenameMarker}
        onRemoveMarker={noop}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Renommer Repère 1' }))
    fireEvent.change(screen.getByLabelText('Nom'), {
      target: { value: 'Intro' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Renommer' }))
    expect(onRenameMarker).toHaveBeenCalledWith('a', 'Intro')
  })

  it('removes a marker', () => {
    const onRemoveMarker = vi.fn()
    render(
      <AnalysisPanel
        markers={markers}
        onSeekMarker={noop}
        onRenameMarker={noop}
        onRemoveMarker={onRemoveMarker}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer Repère 1' }))
    expect(onRemoveMarker).toHaveBeenCalledWith('a')
  })

  it('invites adding markers when there are none', () => {
    render(
      <AnalysisPanel
        markers={[]}
        onSeekMarker={noop}
        onRenameMarker={noop}
        onRemoveMarker={noop}
      />
    )
    expect(screen.getByText(/Aucun repère/)).toBeInTheDocument()
  })
})
