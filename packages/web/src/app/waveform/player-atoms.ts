import {
  initialTransport,
  type LoopRegion,
  type Track,
  type TransportState
} from '@app/core'
import { atom } from 'jotai'

/**
 * The player's view state, owned by this feature (ADR 0010/0011) — the values
 * a region displays, declared here so it reads them itself instead of the
 * shell threading them as props. Only what a region consumes on its own lives
 * here; the rest of the player state stays in `usePlayer` until a consumer
 * pulls it out. Nothing decides anything in this file: every transition stays
 * in the player hooks — the ADRs' anti-erosion guard.
 */

export type ImportState =
  | { readonly status: 'idle' }
  | { readonly status: 'loading' }
  | { readonly status: 'loaded'; readonly track: Track }
  | { readonly status: 'error'; readonly message: string }

/** The import lifecycle — what the main view renders (waveform vs states). */
export const importStateAtom = atom<ImportState>({ status: 'idle' })

/** The transport control state (play/pause, duration) — NOT the playhead,
 * which streams at frame rate outside React state (`PlayerHandle.position`). */
export const transportAtom = atom<TransportState>(initialTransport)

/** The active A/B loop (the « loupe »), or undefined when off. */
export const loopRegionAtom = atom<LoopRegion | undefined>(undefined)

/** Whether the active region actually loops playback (vs playing through). */
export const loopEnabledAtom = atom(true)

/** Pitch shift in whole semitones (0 = original key) — the chart reads it. */
export const pitchSemitonesAtom = atom(0)
