// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import type { SeparationState, StemSet } from '@app/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { SeparationPanel } from './separation-panel.tsx'

const emptyTrack = { sampleRate: 4, durationSeconds: 1, waveform: { peaks: [] } }
const stems: StemSet = [
  { id: 'voix', label: 'Voix', track: emptyTrack },
  { id: 'basse', label: 'Basse', track: emptyTrack }
]

function state(partial: Partial<SeparationState>): SeparationState {
  return { status: 'idle', progress: 0, stems: [], error: undefined, ...partial }
}

describe('SeparationPanel', () => {
  it('separates the loaded track on demand', () => {
    const onSeparate = vi.fn()
    render(
      <SeparationPanel
        state={state({ status: 'idle' })}
        canSeparate
        onSeparate={onSeparate}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Séparer les pistes' }))
    expect(onSeparate).toHaveBeenCalledOnce()
  })

  it('disables the action until a track is loaded', () => {
    render(
      <SeparationPanel
        state={state({ status: 'idle' })}
        canSeparate={false}
        onSeparate={() => {}}
      />
    )
    expect(
      screen.getByRole('button', { name: 'Séparer les pistes' })
    ).toBeDisabled()
  })

  it('shows the running phase and progress, hiding the action', () => {
    render(
      <SeparationPanel
        state={state({ status: 'separating', progress: 0.4 })}
        canSeparate
        onSeparate={() => {}}
      />
    )
    expect(screen.getByText('Séparation des pistes…')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('value', '40')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('lists the separated stems when ready', () => {
    render(
      <SeparationPanel
        state={state({ status: 'ready', progress: 1, stems })}
        canSeparate
        onSeparate={() => {}}
      />
    )
    expect(screen.getByText('Voix')).toBeInTheDocument()
    expect(screen.getByText('Basse')).toBeInTheDocument()
  })

  it('surfaces a failure and offers a retry', () => {
    const onSeparate = vi.fn()
    render(
      <SeparationPanel
        state={state({ status: 'error', error: 'moteur indisponible' })}
        canSeparate
        onSeparate={onSeparate}
      />
    )
    expect(screen.getByRole('alert')).toHaveTextContent('moteur indisponible')
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }))
    expect(onSeparate).toHaveBeenCalledOnce()
  })
})
