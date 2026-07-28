import {
  emptyMixer,
  type MixerAction,
  type MixerState,
  mixerReducer,
  type StemFilter,
  type StemTrack
} from '@app/core'
import { atom } from 'jotai'
import { atomWithReducer } from 'jotai/utils'

/**
 * The mixer's view state, owned by this feature (ADR 0010) — declared here, not
 * in the shell, so a second feature reads it without a prop being threaded.
 * The transitions stay in the core's pure `mixerReducer`: nothing decides
 * anything in this file, which is what keeps the rule out of the adapter.
 */
export const mixerStateAtom = atomWithReducer<MixerState, MixerAction>(
  emptyMixer,
  mixerReducer
)

/**
 * The stems being mixed (present + with PCM), for the channel views — display
 * tracks only, never the PCM: that lives once, in the playback engine.
 */
export const mixableAtom = atom<readonly StemTrack[]>([])

/**
 * Per-stem tone filters — a listening aid, session-only: reset with every fresh
 * mix and NEVER part of `MixerState` (what a save persists).
 */
export const stemFiltersAtom = atom<Readonly<Record<string, StemFilter>>>({})

/**
 * Whether the mixer holds any stem — the transport hands over to the stem engine
 * on it. NOT the same as « a separation is ready »: the metronome can join the
 * mix without any separation having run. A boolean on purpose: it is read on
 * every mixer move but only flips twice a session, and a scalar compares
 * cleanly, so its consumers re-render on the flip and on nothing else.
 */
export const stemsActiveAtom = atom((get) => {
  const mixed = new Set(get(mixableAtom).map((stem) => stem.id))
  return get(mixerStateAtom).some((channel) => mixed.has(channel.id))
})
