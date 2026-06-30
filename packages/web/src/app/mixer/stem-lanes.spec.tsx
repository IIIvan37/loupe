// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
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
  it('renders an aligned waveform lane per stem with its label', () => {
    render(<StemLanes channels={[channel('voix', 'Voix'), channel('basse', 'Basse')]} />)
    expect(screen.getByRole('img', { name: /Voix/ })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /Basse/ })).toBeInTheDocument()
    expect(screen.getByText('Voix')).toBeInTheDocument()
  })

  it('fades a quieter lane below a louder one', () => {
    const { container } = render(
      <StemLanes
        channels={[
          channel('voix', 'Voix', { level: 1 }),
          channel('basse', 'Basse', { level: 0 })
        ]}
      />
    )
    const lanes = container.querySelectorAll('li')
    const loud = Number((lanes[0] as HTMLElement).style.opacity)
    const quiet = Number((lanes[1] as HTMLElement).style.opacity)
    expect(loud).toBeGreaterThan(quiet)
  })

  it('renders nothing without channels', () => {
    const { container } = render(<StemLanes channels={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})
