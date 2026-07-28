// @vitest-environment jsdom
import type { SeparatedStem, StemPlaybackEngine, StemSet } from '@app/core'
import { act, renderHook } from '@testing-library/react'
import { Provider, createStore, useAtomValue } from 'jotai'
import type { ReactNode } from 'react'
import { vi } from 'vitest'
import { stemsActiveAtom } from './mixer-atoms.ts'
import { useMixer } from './use-mixer.ts'

const audio = { sampleRate: 4, channels: [[0, 1, -1, 0.5]] }
const voix: StemSet = [
  {
    id: 'voix',
    label: 'Voix',
    track: { sampleRate: 4, durationSeconds: 1, waveform: { peaks: [] } },
    confidence: 1,
    present: true
  }
]
const sources: readonly SeparatedStem[] = [{ id: 'voix', label: 'Voix', audio }]

/** The stem engine reduced to what the mixer drives — nothing is asserted on it. */
function inertEngine(): StemPlaybackEngine {
  return {
    load: vi.fn(async () => {}),
    addStem: vi.fn(async () => {}),
    removeStem: vi.fn(),
    play: vi.fn(),
    pause: vi.fn(),
    seekTo: vi.fn(),
    setTimeRatio: vi.fn(),
    setPitchSemitones: vi.fn(),
    setGain: vi.fn(),
    stemAudio: () => undefined,
    onPositionChange: () => () => {}
  }
}

/**
 * The mixer and a foreign consumer of its atom, in two separate trees sharing
 * ONE store — the shape the shell will have once the feature owns its state:
 * nothing is passed between them but the atom.
 */
function mountMixerAndConsumer() {
  const store = createStore()
  const wrapper = ({ children }: { readonly children: ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  )
  const mixer = renderHook(() => useMixer(inertEngine()), { wrapper })
  const consumer = renderHook(() => useAtomValue(stemsActiveAtom), { wrapper })
  return { mixer, consumer }
}

describe('stemsActiveAtom', () => {
  it('tells a foreign consumer the mix holds stems, with no prop threaded', () => {
    const { mixer, consumer } = mountMixerAndConsumer()

    act(() => {
      mixer.result.current.load(voix, sources)
    })

    expect(consumer.result.current).toBe(true)
  })

  it('falls back to false once the mixer is emptied', () => {
    const { mixer, consumer } = mountMixerAndConsumer()
    act(() => {
      mixer.result.current.load(voix, sources)
    })

    act(() => {
      mixer.result.current.reset()
    })

    expect(consumer.result.current).toBe(false)
  })
})
