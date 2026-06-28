// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import type { Track } from '@app/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { WaveformView } from './waveform-view.tsx'

const track: Track = {
  sampleRate: 4,
  durationSeconds: 1,
  waveform: { peaks: [{ min: -1, max: 1 }] }
}

const noop = () => {}

describe('WaveformView', () => {
  it('prompts for an import while idle', () => {
    render(<WaveformView state={{ status: 'idle' }} positionRatio={0} onSeek={noop} />)
    expect(screen.getByText(/Importe un fichier audio/)).toBeInTheDocument()
  })

  it('shows progress while decoding', () => {
    render(<WaveformView state={{ status: 'loading' }} positionRatio={0} onSeek={noop} />)
    expect(screen.getByText('Décodage…')).toBeInTheDocument()
  })

  it('reports a failure as an alert', () => {
    render(
      <WaveformView
        state={{ status: 'error', message: 'bad file' }}
        positionRatio={0}
        onSeek={noop}
      />
    )
    expect(screen.getByRole('alert')).toHaveTextContent('bad file')
  })

  it('renders the waveform with a seek surface once loaded', () => {
    render(
      <WaveformView state={{ status: 'loaded', track }} positionRatio={0.5} onSeek={noop} />
    )
    expect(
      screen.getByRole('img', { name: "Forme d'onde de la piste" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Se positionner dans la piste' })
    ).toBeInTheDocument()
  })

  it('seeks to the clicked fraction of the surface', () => {
    const onSeek = vi.fn()
    render(
      <WaveformView state={{ status: 'loaded', track }} positionRatio={0} onSeek={onSeek} />
    )
    const surface = screen.getByRole('button', { name: 'Se positionner dans la piste' })
    surface.getBoundingClientRect = () =>
      ({ left: 0, width: 200 }) as DOMRect
    // detail: 1 marks a real pointer click (detail 0 = keyboard activation).
    fireEvent.click(surface, { clientX: 50, detail: 1 })
    expect(onSeek).toHaveBeenCalledWith(0.25)
  })

  it('ignores keyboard activation of the seek surface', () => {
    const onSeek = vi.fn()
    render(
      <WaveformView state={{ status: 'loaded', track }} positionRatio={0} onSeek={onSeek} />
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Se positionner dans la piste' }),
      { detail: 0 }
    )
    expect(onSeek).not.toHaveBeenCalled()
  })
})
