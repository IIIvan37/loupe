import { decibels } from '@app/core/testing'
// @vitest-environment jsdom
import type {
  BeatGrid,
  DecodedAudio,
  MixerState,
  SeparatedStem,
  StemTrack
} from '@app/core'
import { act, renderHook } from '@testing-library/react'
import { Provider, createStore } from 'jotai'
import type { ReactNode } from 'react'
import { vi } from 'vitest'
import { METRONOME_ID } from '../mixer/synthetic-stem.ts'
import { DEFAULT_METRONOME_CHANNEL } from './metronome-stem.ts'
import { type MetronomeMixer, useMetronome } from './use-metronome.ts'

const audio: DecodedAudio = { sampleRate: 4, channels: [[0, 1, -1, 0.5]] }
const grid: BeatGrid = [{ timeSeconds: 0, downbeat: true }]

// The metronome's seam only — the members it cannot name (load, faders, solo)
// need no stubs anymore: the type keeps them out of reach.
function fakeMixer(state: MixerState = []): MetronomeMixer {
  return {
    state,
    restore: vi.fn(),
    addStem: vi.fn(),
    replaceStem: vi.fn(),
    toggleMute: vi.fn()
  }
}

describe('useMetronome', () => {
  it('enable seats [Piste, Métronome] via a single restore, muted by default', () => {
    const mixer = fakeMixer()
    const { result } = renderHook(() => useMetronome({ mixer }))

    act(() => {
      result.current.enable(grid, audio, DEFAULT_METRONOME_CHANNEL)
    })

    expect(mixer.restore).toHaveBeenCalledOnce()
    const [stems, , channels] = (mixer.restore as ReturnType<typeof vi.fn>).mock
      .calls[0] as [readonly StemTrack[], unknown, MixerState]
    expect(stems.map((s) => s.id)).toEqual(['piste', METRONOME_ID])
    // The click channel is muted; the track plays untouched.
    expect(channels).toEqual([
      { id: 'piste', gainDb: decibels(0), muted: false, soloed: false },
      DEFAULT_METRONOME_CHANNEL
    ])
  })

  it('attach appends the click to the base mixer in one restore', () => {
    const mixer = fakeMixer()
    const { result } = renderHook(() => useMetronome({ mixer }))
    const stem: StemTrack = {
      id: 'voix',
      label: 'Voix',
      track: { sampleRate: 4, durationSeconds: 1, waveform: { peaks: [] } },
      confidence: 1,
      present: true
    }
    const source: SeparatedStem = { id: 'voix', label: 'Voix', audio }
    const baseMixer: MixerState = [
      { id: 'voix', gainDb: decibels(-6), muted: false, soloed: false }
    ]
    const saved = { id: METRONOME_ID, gainDb: decibels(-3), muted: false, soloed: false }

    act(() => {
      result.current.attach(grid, [stem], [source], audio, baseMixer, saved)
    })

    const [stems, , channels] = (mixer.restore as ReturnType<typeof vi.fn>).mock
      .calls[0] as [readonly StemTrack[], unknown, MixerState]
    expect(stems.map((s) => s.id)).toEqual(['voix', METRONOME_ID])
    expect(channels).toEqual([...baseMixer, saved])
  })

  it('join adds the click to the running mix without touching it (AU.1)', () => {
    const mixer = fakeMixer()
    const { result } = renderHook(() => useMetronome({ mixer }), {
      wrapper: Provider
    })

    act(() => {
      result.current.join(grid, audio, DEFAULT_METRONOME_CHANNEL)
    })

    expect(mixer.addStem).toHaveBeenCalledOnce()
    const [stem, , channel] = (mixer.addStem as ReturnType<typeof vi.fn>).mock
      .calls[0] as [StemTrack, SeparatedStem, MixerState[number]]
    expect(stem.id).toBe(METRONOME_ID)
    expect(channel).toEqual(DEFAULT_METRONOME_CHANNEL)
    // The playing stems stay untouched — a restore would cut the playback
    // (and `load` is out of the seam's reach entirely).
    expect(mixer.restore).not.toHaveBeenCalled()
    expect(result.current.enabled).toBe(true)
  })

  it('join swaps the click already mixed, keeping its channel settings', () => {
    const mixer = fakeMixer([
      { id: METRONOME_ID, gainDb: decibels(-3), muted: false, soloed: false }
    ])
    const { result } = renderHook(() => useMetronome({ mixer }), {
      wrapper: Provider
    })

    act(() => {
      result.current.join(grid, audio, DEFAULT_METRONOME_CHANNEL)
    })

    expect(mixer.replaceStem).toHaveBeenCalledOnce()
    expect(mixer.addStem).not.toHaveBeenCalled()
  })

  it('reseat swaps the click stem for the folded grid, keeping its channel', () => {
    const mixer = fakeMixer()
    const { result } = renderHook(() => useMetronome({ mixer }))
    const folded: BeatGrid = [
      { timeSeconds: 0, downbeat: true },
      { timeSeconds: 1, downbeat: false }
    ]

    act(() => {
      result.current.reseat(folded, audio)
    })

    expect(mixer.replaceStem).toHaveBeenCalledOnce()
    const [stem] = (mixer.replaceStem as ReturnType<typeof vi.fn>).mock
      .calls[0] as [StemTrack, SeparatedStem]
    expect(stem.id).toBe(METRONOME_ID)
  })
})

/**
 * Two metronome instances in separate trees sharing ONE store — the shape the
 * app reaches once a coordination hook builds its own instance (ADR 0010):
 * whether a click is seated is session state, not the instance's.
 */
function mountTwoInstances() {
  const store = createStore()
  const wrapper = ({ children }: { readonly children: ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  )
  const mixer = fakeMixer()
  const seater = renderHook(() => useMetronome({ mixer }), { wrapper })
  const reader = renderHook(() => useMetronome({ mixer }), { wrapper })
  return { seater, reader }
}

describe('useMetronome — enabled is session state (ADR 0010)', () => {
  it('tells a second instance the click was seated by the first', () => {
    const { seater, reader } = mountTwoInstances()

    act(() => {
      seater.result.current.enable(grid, audio, DEFAULT_METRONOME_CHANNEL)
    })

    expect(reader.result.current.enabled).toBe(true)
  })

  it('a reset by one instance clears enabled for the other', () => {
    const { seater, reader } = mountTwoInstances()
    act(() => {
      seater.result.current.enable(grid, audio, DEFAULT_METRONOME_CHANNEL)
    })

    act(() => reader.result.current.reset())

    expect(seater.result.current.enabled).toBe(false)
  })
})
