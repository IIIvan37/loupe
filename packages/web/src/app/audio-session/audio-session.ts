import type {
  AudioFileDecoder,
  ChordDetector,
  CountIn,
  PlaybackEngine,
  ProjectDeps,
  StemPlaybackEngine,
  StemSeparator,
  StructureDetector,
  TempoDetector,
  TrackMetadataReader,
  TrackSource
} from '@app/core'
import { createContext, useContext } from 'react'

/**
 * Plays one bar of clicks out of band (the transport hasn't started yet) and
 * reports back when it ends. Returns a cancel that silences the clicks without
 * firing `onEnded`. Declared here (not in the tempo feature) so the session
 * bag below can carry it without a tempo ↔ audio-session cycle.
 */
export interface CountInPlayer {
  readonly play: (countIn: CountIn, onEnded: () => void) => () => void
}

/**
 * The audio session's injectable ports (ADR 0011) — stable references, set
 * once at mount, never rewritten. A consumer hook reads the session to REACH
 * a port, never to create one: an absent entry means « use the real adapter »,
 * decided at the consumption site exactly as before. View state NEVER lives
 * here — anything that changes while the app runs is a feature atom (ADR 0010).
 */
export interface AudioSession {
  readonly decoder?: AudioFileDecoder
  readonly engine?: PlaybackEngine
  readonly stemEngine?: StemPlaybackEngine
  readonly metadataReader?: TrackMetadataReader
  readonly separator?: StemSeparator
  readonly tempoDetector?: TempoDetector
  readonly chordDetector?: ChordDetector
  readonly structureDetector?: StructureDetector
  readonly trackSource?: TrackSource
  readonly projectStores?: ProjectDeps
  readonly countInPlayer?: CountInPlayer
}

/** Empty by default: every consumer falls back to its real adapter.
 * Exported for the Provider component only — consumers use the hook. */
export const AudioSessionContext = createContext<AudioSession>({})

/** Read the session's ports (a stable reference — never re-renders anyone). */
export function useAudioSession(): AudioSession {
  return useContext(AudioSessionContext)
}
