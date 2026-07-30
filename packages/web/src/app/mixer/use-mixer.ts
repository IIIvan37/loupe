import {
  type ChannelGain,
  effectiveGains,
  type MixerAction,
  type MixerState,
  mixerReducer,
  type SeparatedStem,
  type StemFilter,
  type StemPlaybackEngine,
  type StemSet,
  type StemTrack
} from '@app/core'
import { useAtom } from 'jotai'
import { useMemo } from 'react'
import { useAudioSession } from '../audio-session/audio-session.ts'
import { mixableAtom, mixerStateAtom, stemFiltersAtom } from './mixer-atoms.ts'

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
  /** The lane's tone filter (session-only, {} = neutral). */
  readonly filter: StemFilter
}

export interface Mixer {
  readonly channels: readonly MixerChannelView[]
  /** The raw mixer state — what a saved project persists alongside the stems. */
  readonly state: MixerState
  /**
   * Adopt a fresh separation: load the present stems' PCM into the gain graph
   * and seed a unity mixer. Call from the handler that produced them.
   */
  readonly load: (stems: StemSet, sources: readonly SeparatedStem[]) => void
  /**
   * Adopt a restored separation with its persisted mixer settings: load the
   * stems' PCM and push the saved effective gains to the engine.
   */
  readonly restore: (
    stems: StemSet,
    sources: readonly SeparatedStem[],
    saved: MixerState
  ) => void
  /**
   * Add one stem to the running mix (e.g. the metronome): a new unity channel
   * plus its PCM in the gain graph, leaving the other channels untouched.
   */
  readonly addStem: (stem: StemTrack, source: SeparatedStem) => void
  /** Drop one stem from the mix by id, leaving the rest playing. */
  readonly removeStem: (id: string) => void
  /**
   * Swap one present stem's PCM (and lane peaks) for a freshly rendered version
   * of the same id — e.g. re-seating the metronome click after an octave fold.
   * The channel is left untouched, so its fader/mute/solo survive; the engine
   * keeps the gain it holds for that id across the remove/add.
   */
  readonly replaceStem: (stem: StemTrack, source: SeparatedStem) => void
  /** Drop every stem (a new import) — empties the mixer and its lanes. */
  readonly reset: () => void
  readonly setGain: (id: string, gainDb: number) => void
  /** Shape one stem's tone (low/high-cut) — session-only, never persisted. */
  readonly setFilter: (id: string, filter: StemFilter) => void
  readonly toggleMute: (id: string) => void
  readonly toggleSolo: (id: string) => void
}

/** The session's engine is seated by the shell; its absence is a programming
 * error, not a fallback case — the mix has ONE gain graph, so a bare consumer
 * must never create a private engine of its own (unlike stateless ports). */
function requireStemEngine(
  engine: StemPlaybackEngine | undefined
): StemPlaybackEngine {
  if (engine === undefined) {
    throw new Error(
      'useMixer: no stem engine in the audio session — render under the workstation shell'
    )
  }
  return engine
}

/**
 * Smart hook (= driving adapter logic): owns the pure `MixerState` for the
 * present stems and keeps the `StemPlaybackEngine` in step with it. `load` (from
 * the separation handler) loads their PCM into the gain graph and seeds a unity
 * mixer — the engine defaults every channel to unity, so no gains need pushing
 * then; every later control change pushes `effectiveGains` from its own handler,
 * so solo/mute/volume are always reflected in what is heard. The same effective
 * gain (clamped) is each lane's opacity.
 *
 * Callable by any consumer (ADR 0010): the engine argument is the shell stack's
 * (it creates the singleton); a region calls it bare and reaches the same
 * engine through the audio session (ADR 0011).
 */
export function useMixer(injected?: StemPlaybackEngine): Mixer {
  const session = useAudioSession()
  // The state itself lives in the feature's atoms (ADR 0010); the hook keeps
  // what only it can do — driving the playback engine alongside each change.
  const [state, dispatch] = useAtom(mixerStateAtom)
  const [mixable, setMixable] = useAtom(mixableAtom)
  const [filters, setFilters] = useAtom(stemFiltersAtom)

  const channels = useMemo<readonly MixerChannelView[]>(() => {
    const gainById = new Map<string, ChannelGain>(
      effectiveGains(state).map((gain) => [gain.id, gain])
    )
    const stemById = new Map(mixable.map((item) => [item.id, item]))
    return state.flatMap((channel) => {
      const entry = stemById.get(channel.id)
      if (!entry) {
        return []
      }
      const gain = gainById.get(channel.id)?.gain ?? 0
      return [
        {
          stem: entry,
          gainDb: channel.gainDb,
          muted: channel.muted,
          soloed: channel.soloed,
          gain,
          level: Math.min(gain, 1),
          filter: filters[channel.id] ?? {}
        }
      ]
    })
  }, [state, mixable, filters])

  const engine = requireStemEngine(injected ?? session.stemEngine)

  // Pair each present stem with its PCM, hand the pairs to the gain graph and
  // adopt the display tracks. Both `load` and `restore` start here; only the
  // seeding differs. The PCM pairs stay local to this call: once the engine
  // holds the buffers, nothing in React must keep the arrays alive.
  function adopt(
    stems: StemSet,
    sources: readonly SeparatedStem[]
  ): readonly StemTrack[] {
    const byId = new Map(sources.map((source) => [source.id, source]))
    const pairs = stems.flatMap((stem) => {
      const source = byId.get(stem.id)
      return stem.present && source ? [{ stem, source }] : []
    })
    const next = pairs.map((entry) => entry.stem)
    setMixable(next)
    // A fresh mix means fresh (neutral) engine nodes — drop the old filters.
    setFilters({})
    void engine.load(
      pairs.map((entry) => ({ id: entry.source.id, audio: entry.source.audio }))
    )
    return next
  }

  function load(stems: StemSet, sources: readonly SeparatedStem[]): void {
    const next = adopt(stems, sources)
    dispatch({ type: 'init', ids: next.map((stem) => stem.id) })
  }

  function restore(
    stems: StemSet,
    sources: readonly SeparatedStem[],
    saved: MixerState
  ): void {
    adopt(stems, sources)
    dispatch({ type: 'restore', channels: saved })
    // A restored mixer rarely sits at unity (the engine's default after a load),
    // so push its effective gains — the engine keeps them across the async load.
    for (const { id, gain } of effectiveGains(saved)) {
      engine.setGain(id, gain)
    }
  }

  function addStem(stem: StemTrack, source: SeparatedStem): void {
    setMixable((prev) =>
      prev.some((entry) => entry.id === stem.id) ? prev : [...prev, stem]
    )
    void engine.addStem({ id: source.id, audio: source.audio })
    dispatch({ type: 'addChannel', id: stem.id })
  }

  function removeStem(id: string): void {
    setMixable((prev) => prev.filter((entry) => entry.id !== id))
    engine.removeStem(id)
    dispatch({ type: 'removeChannel', id })
  }

  function replaceStem(stem: StemTrack, source: SeparatedStem): void {
    // Only re-seat a stem that is actually mixed; swap its PCM in the engine and
    // its peaks in the lane, but dispatch no channel action — the reducer keeps
    // the fader/mute/solo, and the engine restores the gain it holds for this id.
    setMixable((prev) => {
      if (!prev.some((entry) => entry.id === stem.id)) {
        return prev
      }
      return prev.map((entry) => (entry.id === stem.id ? stem : entry))
    })
    engine.removeStem(source.id)
    void engine.addStem({ id: source.id, audio: source.audio })
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

  return {
    channels,
    state,
    load,
    restore,
    addStem,
    removeStem,
    replaceStem,
    reset,
    setGain: (id, gainDb) => apply({ type: 'setGain', id, gainDb }),
    setFilter: (id, filter) => {
      setFilters((prev) => ({ ...prev, [id]: filter }))
      engine.setStemFilter?.(id, filter)
    },
    toggleMute: (id) => apply({ type: 'toggleMute', id }),
    toggleSolo: (id) => apply({ type: 'toggleSolo', id })
  }
}
