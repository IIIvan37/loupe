// @vitest-environment jsdom
import {
  dbToAmplitude,
  type MixerState,
  type SeparatedStem,
  type StemSet,
  type StemSource
} from '@app/core'
import { act, renderHook } from '@testing-library/react'
import { vi } from 'vitest'
import { type Mixer, useMixer } from './use-mixer.ts'

const audio = { sampleRate: 4, channels: [[0, 1, -1, 0.5]] }
const emptyTrack = { sampleRate: 4, durationSeconds: 1, waveform: { peaks: [] } }

function stem(id: string, label: string, present = true): StemSet[number] {
  return { id, label, track: emptyTrack, confidence: 1, present }
}

const stems: StemSet = [stem('voix', 'Voix'), stem('basse', 'Basse')]
const sources: readonly SeparatedStem[] = [
  { id: 'voix', label: 'Voix', audio },
  { id: 'basse', label: 'Basse', audio }
]

/** A spy stem engine recording the gains and loads it receives. */
function fakeEngine() {
  return {
    load: vi.fn<(stems: readonly StemSource[]) => Promise<void>>(
      async () => {}
    ),
    play: vi.fn(),
    pause: vi.fn(),
    seekTo: vi.fn(),
    setTimeRatio: vi.fn(),
    setPitchSemitones: vi.fn(),
    setGain: vi.fn<(id: string, gain: number) => void>(),
    onPositionChange: vi.fn(() => () => {})
  }
}

/** Mount the hook and load it with the given stems/sources (a fresh separation). */
function mountLoaded(
  engine: ReturnType<typeof fakeEngine>,
  withStems: StemSet = stems,
  withSources: readonly SeparatedStem[] = sources
): { result: { current: Mixer } } {
  const hook = renderHook(() => useMixer(engine))
  act(() => {
    hook.result.current.load(withStems, withSources)
  })
  return hook
}

describe('useMixer', () => {
  it('loads the stem PCM into the engine and exposes a channel per stem', () => {
    const engine = fakeEngine()
    const { result } = mountLoaded(engine)

    expect(engine.load).toHaveBeenCalledOnce()
    expect(engine.load.mock.calls[0]?.[0]).toEqual([
      { id: 'voix', audio },
      { id: 'basse', audio }
    ])
    expect(result.current.channels.map((c) => c.stem.id)).toEqual([
      'voix',
      'basse'
    ])
    // Every channel starts at unity, unmuted, unsoloed, fully opaque.
    expect(result.current.channels[0]).toMatchObject({
      gainDb: 0,
      muted: false,
      soloed: false,
      level: 1
    })
  })

  it('leaves the gains to the engine default on load (unity, no push)', () => {
    const engine = fakeEngine()
    mountLoaded(engine)
    // The freshly loaded graph already sits at unity, so nothing is pushed yet.
    expect(engine.setGain).not.toHaveBeenCalled()
  })

  it('empties the mixer on reset', () => {
    const engine = fakeEngine()
    const { result } = mountLoaded(engine)
    act(() => {
      result.current.reset()
    })
    expect(result.current.channels).toEqual([])
  })

  it('mutes a channel: its engine gain and its waveform level drop to 0', () => {
    const engine = fakeEngine()
    const { result } = mountLoaded(engine)

    act(() => {
      result.current.toggleMute('voix')
    })
    expect(engine.setGain).toHaveBeenCalledWith('voix', 0)
    const voix = result.current.channels.find((c) => c.stem.id === 'voix')
    expect(voix?.muted).toBe(true)
    expect(voix?.level).toBe(0)
  })

  it('solo silences the other channels', () => {
    const engine = fakeEngine()
    const { result } = mountLoaded(engine)

    act(() => {
      result.current.toggleSolo('voix')
    })
    const basse = result.current.channels.find((c) => c.stem.id === 'basse')
    expect(basse?.level).toBe(0)
    expect(engine.setGain).toHaveBeenLastCalledWith('basse', 0)
  })

  it('applies a dB fader change to the engine and the level', () => {
    const engine = fakeEngine()
    const { result } = mountLoaded(engine)

    act(() => {
      result.current.setGain('voix', -6)
    })
    const voix = result.current.channels.find((c) => c.stem.id === 'voix')
    expect(voix?.gainDb).toBe(-6)
    expect(voix?.level).toBeCloseTo(dbToAmplitude(-6))
    expect(engine.setGain).toHaveBeenCalledWith('voix', dbToAmplitude(-6))
  })

  it('exposes the audible-mix envelope, dropping muted stems from it', () => {
    const track = {
      sampleRate: 4,
      durationSeconds: 1,
      waveform: { peaks: [{ min: -0.4, max: 0.4 }] }
    }
    const loud: StemSet = [
      { id: 'voix', label: 'Voix', track, confidence: 1, present: true },
      { id: 'basse', label: 'Basse', track, confidence: 1, present: true }
    ]
    const engine = fakeEngine()
    const { result } = mountLoaded(engine, loud)

    // Both at unity → the two equal envelopes sum.
    expect(result.current.mixWaveform.peaks[0]).toEqual({ min: -0.8, max: 0.8 })

    act(() => {
      result.current.toggleMute('voix')
    })
    // Muting one leaves only the other's envelope.
    expect(result.current.mixWaveform.peaks[0]).toEqual({ min: -0.4, max: 0.4 })
  })

  it('restores a persisted mixer and pushes its effective gains to the engine', () => {
    const engine = fakeEngine()
    const hook = renderHook(() => useMixer(engine))
    const saved: MixerState = [
      { id: 'voix', gainDb: -6, muted: false, soloed: false },
      { id: 'basse', gainDb: 0, muted: true, soloed: false }
    ]

    act(() => {
      hook.result.current.restore(stems, sources, saved)
    })

    expect(engine.load).toHaveBeenCalledOnce()
    expect(hook.result.current.state).toEqual(saved)
    // Unlike a fresh load, restored gains rarely sit at unity — they are pushed.
    expect(engine.setGain).toHaveBeenCalledWith('voix', dbToAmplitude(-6))
    expect(engine.setGain).toHaveBeenCalledWith('basse', 0)
    const basse = hook.result.current.channels.find(
      (c) => c.stem.id === 'basse'
    )
    expect(basse?.muted).toBe(true)
    expect(basse?.level).toBe(0)
  })

  it('only mixes the stems that are present and whose PCM is available', () => {
    const engine = fakeEngine()
    // A present stem with no matching source, and an absent one: both excluded.
    const withGhosts: StemSet = [
      ...stems,
      stem('autres', 'Autres'),
      stem('guitare', 'Guitare', false)
    ]
    const { result } = mountLoaded(engine, withGhosts)

    expect(result.current.channels.map((c) => c.stem.id)).toEqual([
      'voix',
      'basse'
    ])
    expect(engine.load.mock.calls[0]?.[0]).toHaveLength(2)
  })
})
