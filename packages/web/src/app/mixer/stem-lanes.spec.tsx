// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { I18nTestingProvider } from '../../i18n/i18n-testing-provider.tsx'
import type { MixerChannelView } from './use-mixer.ts'
import { StemLanes } from './stem-lanes.tsx'

const emptyTrack = { sampleRate: 4, durationSeconds: 1, waveform: { peaks: [] } }

function channel(
  id: string,
  label: string,
  partial: Partial<MixerChannelView> = {}
): MixerChannelView {
  return {
    stem: { id, label, track: emptyTrack, confidence: 1, present: true },
    gainDb: 0,
    muted: false,
    soloed: false,
    gain: 1,
    level: 1,
    ...partial
  }
}

describe('StemLanes', () => {
  it('renders an aligned waveform lane per stem', () => {
    render(
      <StemLanes
        channels={[channel('voix', 'Voix'), channel('basse', 'Basse')]}
      />,
      { wrapper: I18nTestingProvider }
    )
    expect(screen.getByRole('img', { name: /Voix/ })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /Basse/ })).toBeInTheDocument()
  })

  it('fades a quieter lane below a louder one', () => {
    const { container } = render(
      <StemLanes
        channels={[
          channel('voix', 'Voix', { level: 1 }),
          channel('basse', 'Basse', { level: 0 })
        ]}
      />,
      { wrapper: I18nTestingProvider }
    )
    // The fade lives on the envelope wrapper (the div inside each lane).
    const waves = container.querySelectorAll('li > div')
    const loud = Number((waves[0] as HTMLElement).style.opacity)
    const quiet = Number((waves[1] as HTMLElement).style.opacity)
    expect(loud).toBeGreaterThan(quiet)
  })

  it('renders nothing without channels', () => {
    const { container } = render(<StemLanes channels={[]} />, {
      wrapper: I18nTestingProvider
    })
    expect(container).toBeEmptyDOMElement()
  })
})
