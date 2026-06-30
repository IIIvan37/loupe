// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import type { MixerChannelView } from './use-mixer.ts'
import { MixerPanel } from './mixer-panel.tsx'

const emptyTrack = { sampleRate: 4, durationSeconds: 1, waveform: { peaks: [] } }

function channel(
  id: string,
  label: string,
  partial: Partial<MixerChannelView> = {}
): MixerChannelView {
  return {
    stem: { id, label, track: emptyTrack, confidence: 0.9, present: true },
    gainDb: 0,
    muted: false,
    soloed: false,
    gain: 1,
    level: 1,
    ...partial
  }
}

function renderPanel(
  channels: readonly MixerChannelView[],
  props: Partial<Parameters<typeof MixerPanel>[0]> = {}
) {
  return render(
    <MixerPanel
      channels={channels}
      onSetGain={() => {}}
      onToggleMute={() => {}}
      onToggleSolo={() => {}}
      onDownloadStem={() => {}}
      {...props}
    />
  )
}

describe('MixerPanel', () => {
  it('renders a strip per channel with its label and confidence', () => {
    renderPanel([channel('voix', 'Voix'), channel('basse', 'Basse')])
    expect(screen.getByText('Voix')).toBeInTheDocument()
    expect(screen.getByText('Basse')).toBeInTheDocument()
    expect(screen.getAllByText('90 %')).toHaveLength(2)
  })

  it('toggles mute and reflects the muted state', () => {
    const onToggleMute = vi.fn()
    renderPanel([channel('voix', 'Voix', { muted: true })], { onToggleMute })
    const button = screen.getByRole('button', { name: 'Couper Voix' })
    expect(button).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(button)
    expect(onToggleMute).toHaveBeenCalledWith('voix')
  })

  it('toggles solo and reflects the soloed state', () => {
    const onToggleSolo = vi.fn()
    renderPanel([channel('voix', 'Voix', { soloed: true })], { onToggleSolo })
    const button = screen.getByRole('button', { name: 'Isoler Voix' })
    expect(button).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(button)
    expect(onToggleSolo).toHaveBeenCalledWith('voix')
  })

  it('moves the dB fader', () => {
    const onSetGain = vi.fn()
    renderPanel([channel('voix', 'Voix')], { onSetGain })
    fireEvent.change(screen.getByRole('slider', { name: 'Volume Voix' }), {
      target: { value: '-6' }
    })
    expect(onSetGain).toHaveBeenCalledWith('voix', -6)
  })

  it('shows the fader level in dB', () => {
    renderPanel([channel('voix', 'Voix', { gainDb: -6 })])
    expect(screen.getByText('-6 dB')).toBeInTheDocument()
  })

  it('downloads a stem as WAV', () => {
    const onDownloadStem = vi.fn()
    renderPanel([channel('basse', 'Basse')], { onDownloadStem })
    fireEvent.click(
      screen.getByRole('button', { name: 'Télécharger Basse en WAV' })
    )
    expect(onDownloadStem).toHaveBeenCalledWith('basse')
  })

  it('renders nothing without channels', () => {
    const { container } = renderPanel([])
    expect(container).toBeEmptyDOMElement()
  })
})
