import {
  type ChannelGain,
  combineWaveforms,
  effectiveGains,
  emptyMixer,
  type MixerAction,
  mixerReducer,
  type SeparatedStem,
  type StemPlaybackEngine,
  type StemSet,
  type StemTrack,
  type Waveform
} from '@app/core'
import { useMemo, useReducer, useState } from 'react'

/** One mixer strip: the stem to display + its live controls and fading level. */
export interface MixerChannelView {
  readonly stem: StemTrack
  /** Fader position in dB. */
  readonly gainDb: number
  readonly muted: boolean
  readonly soloed: boolean
  /** Effective linear gain (0 when silenced), what is actually heard / mixed. */
  readonly gain: number
  /** Effective amplitude clamped to [0, 1] — the lane's opacity. */
  readonly level: number
}

export interface Mixer {
  readonly channels: readonly MixerChannelView[]
  /** Envelope of the audible mix, recomputed as the controls change. */
  readonly mixWaveform: Waveform
  /**
   * Adopt a fresh separation: load the present stems' PCM into the gain graph
   * and seed a unity mixer. Call from the handler that produced them.
   */
  readonly load: (stems: StemSet, sources: readonly SeparatedStem[]) => void
  /** Drop every stem (a new import) — empties the mixer and its lanes. */
  readonly reset: () => void
  readonly setGain: (id: string, gainDb: number) => void
  readonly toggleMute: (id: string) => void
  readonly toggleSolo: (id: string) => void
}

interface Mixable {
  readonly stem: StemTrack
  readonly source: SeparatedStem
}

/**
 * Smart hook (= driving adapter logic): owns the pure `MixerState` for the
 * present stems and keeps the `StemPlaybackEngine` in step with it. `load` (from
 * the separation handler) loads their PCM into the gain graph and seeds a unity
 * mixer — the engine defaults every channel to unity, so no gains need pushing
 * then; every later control change pushes `effectiveGains` from its own handler,
 * so solo/mute/volume are always reflected in what is heard. The same effective
 * gain (clamped) is each lane's opacity.
 */
export function useMixer(engine: StemPlaybackEngine): Mixer {
  const [state, dispatch] = useReducer(mixerReducer, emptyMixer)
  // The stems being mixed (present + with PCM), kept for the channel views.
  const [mixable, setMixable] = useState<readonly Mixable[]>([])

  function load(stems: StemSet, sources: readonly SeparatedStem[]): void {
    const byId = new Map(sources.map((source) => [source.id, source]))
    const next = stems.flatMap((stem) => {
      const source = byId.get(stem.id)
      return stem.present && source ? [{ stem, source }] : []
    })
    setMixable(next)
    dispatch({ type: 'init', ids: next.map((entry) => entry.stem.id) })
    void engine.load(
      next.map((entry) => ({ id: entry.source.id, audio: entry.source.audio }))
    )
  }

  function reset(): void {
    setMixable([])
    dispatch({ type: 'reset' })
  }

  // Apply a control change to the mixer AND the live gain graph in the same
  // handler that triggered it — solo/mute shift every channel's effective gain.
  function apply(action: MixerAction): void {
    const next = mixerReducer(state, action)
    dispatch(action)
    for (const { id, gain } of effectiveGains(next)) {
      engine.setGain(id, gain)
    }
  }

  const channels = useMemo<readonly MixerChannelView[]>(() => {
    const gainById = new Map<string, ChannelGain>(
      effectiveGains(state).map((gain) => [gain.id, gain])
    )
    return state.flatMap((channel) => {
      const entry = mixable.find((item) => item.stem.id === channel.id)
      if (!entry) {
        return []
      }
      const gain = gainById.get(channel.id)?.gain ?? 0
      return [
        {
          stem: entry.stem,
          gainDb: channel.gainDb,
          muted: channel.muted,
          soloed: channel.soloed,
          gain,
          level: Math.min(gain, 1)
        }
      ]
    })
  }, [state, mixable])

  const mixWaveform = useMemo<Waveform>(
    () =>
      combineWaveforms(
        channels.map((channel) => ({
          waveform: channel.stem.track.waveform,
          gain: channel.gain
        }))
      ),
    [channels]
  )

  return {
    channels,
    mixWaveform,
    load,
    reset,
    setGain: (id, gainDb) => apply({ type: 'setGain', id, gainDb }),
    toggleMute: (id) => apply({ type: 'toggleMute', id }),
    toggleSolo: (id) => apply({ type: 'toggleSolo', id })
  }
}
