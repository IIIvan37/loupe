// @vitest-environment jsdom
import type {
  BeatGrid,
  DecodedAudio,
  MixerState,
  SeparatedStem,
  StemTrack
} from '@app/core'
import { act, renderHook } from '@testing-library/react'
import { vi } from 'vitest'
import type { Mixer } from '../mixer/use-mixer.ts'
import { DEFAULT_METRONOME_CHANNEL, METRONOME_ID } from './metronome-stem.ts'
import { useMetronome } from './use-metronome.ts'

const audio: DecodedAudio = { sampleRate: 4, channels: [[0, 1, -1, 0.5]] }
const grid: BeatGrid = [{ timeSeconds: 0, downbeat: true }]

function fakeMixer(): Mixer {
  return {
    channels: [],
    state: [],
    load: vi.fn(),
    restore: vi.fn(),
    addStem: vi.fn(),
    removeStem: vi.fn(),
    replaceStem: vi.fn(),
    reset: vi.fn(),
    setGain: vi.fn(),
    toggleMute: vi.fn(),
    toggleSolo: vi.fn()
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
      { id: 'piste', gainDb: 0, muted: false, soloed: false },
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
      { id: 'voix', gainDb: -6, muted: false, soloed: false }
    ]
    const saved = { id: METRONOME_ID, gainDb: -3, muted: false, soloed: false }

    act(() => {
      result.current.attach(grid, [stem], [source], audio, baseMixer, saved)
    })

    const [stems, , channels] = (mixer.restore as ReturnType<typeof vi.fn>).mock
      .calls[0] as [readonly StemTrack[], unknown, MixerState]
    expect(stems.map((s) => s.id)).toEqual(['voix', METRONOME_ID])
    expect(channels).toEqual([...baseMixer, saved])
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
