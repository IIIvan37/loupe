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

function renderPanel(
  partial: Partial<SeparationState>,
  props: Partial<Parameters<typeof SeparationPanel>[0]> = {}
) {
  return render(
    <SeparationPanel
      state={state(partial)}
      canSeparate
      onSeparate={() => {}}
      onDownloadStem={() => {}}
      {...props}
    />
  )
}

describe('SeparationPanel', () => {
  it('separates the loaded track on demand', () => {
    const onSeparate = vi.fn()
    renderPanel({ status: 'idle' }, { onSeparate })
    fireEvent.click(screen.getByRole('button', { name: 'Séparer les pistes' }))
    expect(onSeparate).toHaveBeenCalledOnce()
  })

  it('disables the action until a track is loaded', () => {
    renderPanel({ status: 'idle' }, { canSeparate: false })
    expect(
      screen.getByRole('button', { name: 'Séparer les pistes' })
    ).toBeDisabled()
  })

  it('shows the running phase and progress, hiding the action', () => {
    renderPanel({ status: 'separating', progress: 0.4 })
    expect(screen.getByText('Séparation des pistes…')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('value', '40')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('lists the separated stems when ready', () => {
    renderPanel({ status: 'ready', progress: 1, stems })
    expect(screen.getByText('Voix')).toBeInTheDocument()
    expect(screen.getByText('Basse')).toBeInTheDocument()
  })

  it('downloads a stem as WAV when its button is clicked', () => {
    const onDownloadStem = vi.fn()
    renderPanel({ status: 'ready', progress: 1, stems }, { onDownloadStem })
    fireEvent.click(
      screen.getByRole('button', { name: 'Télécharger Basse en WAV' })
    )
    expect(onDownloadStem).toHaveBeenCalledWith('basse')
  })

  it('surfaces a failure and offers a retry', () => {
    const onSeparate = vi.fn()
    renderPanel({ status: 'error', error: 'moteur indisponible' }, { onSeparate })
    expect(screen.getByRole('alert')).toHaveTextContent('moteur indisponible')
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }))
    expect(onSeparate).toHaveBeenCalledOnce()
  })
})
