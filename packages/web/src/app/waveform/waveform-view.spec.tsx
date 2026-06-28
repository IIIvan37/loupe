// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import type { Track } from '@app/core'
import { WaveformView } from './waveform-view.tsx'

const track: Track = {
  sampleRate: 4,
  durationSeconds: 1,
  waveform: { peaks: [{ min: -1, max: 1 }] }
}

describe('WaveformView', () => {
  it('prompts for an import while idle', () => {
    render(<WaveformView state={{ status: 'idle' }} />)
    expect(screen.getByText(/Importe un fichier audio/)).toBeInTheDocument()
  })

  it('shows progress while decoding', () => {
    render(<WaveformView state={{ status: 'loading' }} />)
    expect(screen.getByText('Décodage…')).toBeInTheDocument()
  })

  it('reports a failure as an alert', () => {
    render(<WaveformView state={{ status: 'error', message: 'bad file' }} />)
    expect(screen.getByRole('alert')).toHaveTextContent('bad file')
  })

  it('renders the waveform and duration once loaded', () => {
    render(<WaveformView state={{ status: 'loaded', track }} />)
    expect(
      screen.getByRole('img', { name: "Forme d'onde de la piste" })
    ).toBeInTheDocument()
    expect(screen.getByText('1.0 s')).toBeInTheDocument()
  })
})
