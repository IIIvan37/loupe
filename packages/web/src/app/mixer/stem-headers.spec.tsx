// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { i18n } from '../../i18n/i18n.ts'
import { I18nTestingProvider } from '../../i18n/i18n-testing-provider.tsx'
import type { MixerChannelView } from './use-mixer.ts'
import { StemHeaders } from './stem-headers.tsx'

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
    filter: {},
    ...partial
  }
}

function renderHeaders(
  channels: readonly MixerChannelView[],
  props: Partial<Parameters<typeof StemHeaders>[0]> = {}
) {
  return render(
    <StemHeaders
      channels={channels}
      onSetGain={() => {}}
      onSetFilter={() => {}}
      onToggleMute={() => {}}
      onToggleSolo={() => {}}
      onDownloadStem={() => {}}
      {...props}
    />,
    { wrapper: I18nTestingProvider }
  )
}

describe('StemHeaders', () => {
  it('renders a track header per channel with its label', () => {
    renderHeaders([channel('voix', 'Voix'), channel('basse', 'Basse')])
    expect(screen.getByText('Voix')).toBeInTheDocument()
    expect(screen.getByText('Basse')).toBeInTheDocument()
  })

  it('carries the machine confidence as the label tooltip', () => {
    renderHeaders([channel('voix', 'Voix')])
    expect(screen.getByText('Voix')).toHaveAccessibleDescription(
      i18n._('mixer.confidence', { percent: 90 })
    )
  })

  it('toggles mute and reflects the muted state', async () => {
    const user = userEvent.setup()
    const onToggleMute = vi.fn()
    renderHeaders([channel('voix', 'Voix', { muted: true })], { onToggleMute })
    const button = screen.getByRole('button', {
      name: i18n._('mixer.mute', { name: 'Voix' })
    })
    expect(button).toHaveAttribute('aria-pressed', 'true')
    await user.click(button)
    expect(onToggleMute).toHaveBeenCalledWith('voix')
  })

  it('toggles solo and reflects the soloed state', async () => {
    const user = userEvent.setup()
    const onToggleSolo = vi.fn()
    renderHeaders([channel('voix', 'Voix', { soloed: true })], { onToggleSolo })
    const button = screen.getByRole('button', {
      name: i18n._('mixer.solo', { name: 'Voix' })
    })
    expect(button).toHaveAttribute('aria-pressed', 'true')
    await user.click(button)
    expect(onToggleSolo).toHaveBeenCalledWith('voix')
  })

  it("cuts a stem's lows through the low-cut slider", () => {
    const onSetFilter = vi.fn()
    renderHeaders([channel('voix', 'Voix')], { onSetFilter })
    fireEvent.change(
      screen.getByLabelText(i18n._('mixer.low-cut', { name: 'Voix' })),
      { target: { value: '200' } }
    )
    expect(onSetFilter).toHaveBeenCalledWith('voix', { lowCutHz: 200 })
  })

  it("cuts a stem's highs through the high-cut slider", () => {
    const onSetFilter = vi.fn()
    renderHeaders([channel('voix', 'Voix')], { onSetFilter })
    fireEvent.change(
      screen.getByLabelText(i18n._('mixer.high-cut', { name: 'Voix' })),
      { target: { value: '8000' } }
    )
    expect(onSetFilter).toHaveBeenCalledWith('voix', { highCutHz: 8000 })
  })

  it('reads a slider parked at its edge as « that side off »', () => {
    const onSetFilter = vi.fn()
    renderHeaders(
      [channel('voix', 'Voix', { filter: { lowCutHz: 200, highCutHz: 8000 } })],
      { onSetFilter }
    )
    fireEvent.change(
      screen.getByLabelText(i18n._('mixer.low-cut', { name: 'Voix' })),
      { target: { value: '20' } }
    )
    expect(onSetFilter).toHaveBeenCalledWith('voix', { highCutHz: 8000 })
  })

  it('moves the dB fader', () => {
    const onSetGain = vi.fn()
    renderHeaders([channel('voix', 'Voix')], { onSetGain })
    // fireEvent kept: user-event cannot drive <input type="range">.
    fireEvent.change(
      screen.getByRole('slider', {
        name: i18n._('mixer.volume', { name: 'Voix' })
      }),
      { target: { value: '-6' } }
    )
    expect(onSetGain).toHaveBeenCalledWith('voix', -6)
  })

  it('shows the fader level in dB', () => {
    renderHeaders([channel('voix', 'Voix', { gainDb: -6 })])
    expect(screen.getByText('-6 dB')).toBeInTheDocument()
  })

  it('downloads a stem as WAV', async () => {
    const user = userEvent.setup()
    const onDownloadStem = vi.fn()
    renderHeaders([channel('basse', 'Basse')], { onDownloadStem })
    await user.click(
      screen.getByRole('button', {
        name: i18n._('mixer.download-wav', { name: 'Basse' })
      })
    )
    expect(onDownloadStem).toHaveBeenCalledWith('basse')
  })

  it('renders nothing without channels', () => {
    const { container } = renderHeaders([])
    expect(container).toBeEmptyDOMElement()
  })
})
