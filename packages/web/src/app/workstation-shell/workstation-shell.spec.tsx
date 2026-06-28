// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import type { AudioFileDecoder } from '@app/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { WorkstationShell } from './workstation-shell.tsx'

describe('WorkstationShell', () => {
  it('renders the core workstation landmarks', () => {
    render(<WorkstationShell />)

    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(screen.getByRole('main')).toBeInTheDocument()
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
  })

  it('shows the product wordmark', () => {
    render(<WorkstationShell />)

    expect(screen.getByText('Loupe')).toBeInTheDocument()
  })

  it('exposes the analysis tabs', () => {
    render(<WorkstationShell />)

    expect(screen.getByRole('tab', { name: 'Spectre' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Repères' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Notes' })).toBeInTheDocument()
  })

  it('prompts for an import before any file is picked', () => {
    render(<WorkstationShell />)

    expect(screen.getByText(/Importe un fichier audio/)).toBeInTheDocument()
  })

  it('decodes a picked file and renders its waveform via the single import control', async () => {
    const decoder: AudioFileDecoder = {
      decode: async () => ({ sampleRate: 4, channels: [[0, 1, -1, 0.5]] })
    }
    render(<WorkstationShell decoder={decoder} />)

    const file = new File([new Uint8Array([1, 2, 3, 4])], 'take.wav', {
      type: 'audio/wav'
    })
    fireEvent.change(screen.getByLabelText('Importer un fichier audio'), {
      target: { files: [file] }
    })

    await waitFor(() => {
      expect(
        screen.getByRole('img', { name: "Forme d'onde de la piste" })
      ).toBeInTheDocument()
    })
    // 4 samples / 4 Hz = 1.0 s.
    expect(screen.getByText('1.0 s')).toBeInTheDocument()
  })

  it('surfaces a decode failure as an alert', async () => {
    const decoder: AudioFileDecoder = {
      decode: async () => {
        throw new Error('unsupported format')
      }
    }
    render(<WorkstationShell decoder={decoder} />)

    const file = new File([new Uint8Array([1, 2, 3, 4])], 'broken.wav', {
      type: 'audio/wav'
    })
    fireEvent.change(screen.getByLabelText('Importer un fichier audio'), {
      target: { files: [file] }
    })

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('unsupported format')
    })
  })
})
