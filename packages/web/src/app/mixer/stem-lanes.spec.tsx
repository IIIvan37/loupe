// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
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
    filter: {},
    ...partial
  }
}

function renderLanes(
  channels: readonly MixerChannelView[],
  props: { onSeekRatio?: (ratio: number) => void; durationSeconds?: number } = {}
) {
  const result = render(
    <StemLanes
      channels={channels}
      onSeekRatio={props.onSeekRatio ?? (() => {})}
      durationSeconds={props.durationSeconds ?? 100}
    />,
    { wrapper: I18nTestingProvider }
  )
  // jsdom gives every element a zero-width rect; pin one so pointer ratios
  // map cleanly (0–100 px → 0–1), mirroring the main waveform's specs.
  const surface = result.container.querySelector(
    '[data-testid="stem-lanes-surface"]'
  ) as HTMLElement
  if (surface) {
    surface.getBoundingClientRect = () =>
      ({ left: 0, width: 100 }) as DOMRect
  }
  return { ...result, surface }
}

describe('StemLanes', () => {
  it('renders an aligned waveform lane per stem', () => {
    renderLanes([channel('voix', 'Voix'), channel('basse', 'Basse')])
    expect(screen.getByRole('img', { name: /Voix/ })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /Basse/ })).toBeInTheDocument()
  })

  it('fades a quieter lane below a louder one', () => {
    const { container } = renderLanes([
      channel('voix', 'Voix', { level: 1 }),
      channel('basse', 'Basse', { level: 0 })
    ])
    // The fade lives on the envelope wrapper (the div inside each lane).
    const waves = container.querySelectorAll('li > div')
    const loud = Number((waves[0] as HTMLElement).style.opacity)
    const quiet = Number((waves[1] as HTMLElement).style.opacity)
    expect(loud).toBeGreaterThan(quiet)
  })

  it('renders nothing without channels', () => {
    const { container } = renderLanes([])
    expect(container).toBeEmptyDOMElement()
  })

  it('seeks to the clicked ratio anywhere on the stems', () => {
    const onSeekRatio = vi.fn()
    const { surface } = renderLanes([channel('voix', 'Voix')], { onSeekRatio })
    fireEvent.pointerUp(surface, { button: 0, clientX: 30 })
    expect(onSeekRatio).toHaveBeenCalledWith(0.3)
  })

  it('shows one hover cursor tracking the pointer, cleared on leave', () => {
    const { container, surface } = renderLanes([channel('voix', 'Voix')])
    expect(
      container.querySelector('[data-testid="stem-lanes-hover"]')
    ).not.toBeInTheDocument()

    fireEvent.pointerMove(surface, { clientX: 40 })
    const cursors = container.querySelectorAll(
      '[data-testid="stem-lanes-hover"]'
    )
    expect(cursors).toHaveLength(1)
    expect((cursors[0] as HTMLElement).style.left).toBe('40%')

    fireEvent.pointerLeave(surface)
    expect(
      container.querySelector('[data-testid="stem-lanes-hover"]')
    ).not.toBeInTheDocument()
  })
})
