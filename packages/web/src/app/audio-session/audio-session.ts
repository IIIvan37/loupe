import type {
  AudioFileDecoder,
  ChordDetector,
  CountIn,
  PlaybackEngine,
  ProjectDeps,
  SpectrumFrame,
  SpeedTrainerPolicy,
  StemPlaybackEngine,
  StemSeparator,
  StructureDetector,
  TempoDetector,
  TrackMetadataReader,
  TrackSource
} from '@app/core'
import { createContext, useContext } from 'react'
import type { ExternalValue } from '../../lib/external-value.ts'

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
 * The player as a STABLE REFERENCE (ADR 0011): the imperative surface a
 * region reaches through the session to drive playback — never to create it.
 * Its identity never changes across renders, so reading it re-renders no one;
 * everything reactive stays out of it (view state in the player's atoms, the
 * playhead as an {@link ExternalValue}). Declared here (not in the waveform
 * feature, which implements it) so the session bag can carry it without a
 * waveform ↔ audio-session cycle — the same seam as {@link CountInPlayer}.
 */
export interface PlayerHandle {
  /** The playhead, streamed at frame rate outside React state (Lot L.1). */
  readonly position: ExternalValue<number>
  /** One read of the ACTIVE engine's output spectrum (undefined = no tap). */
  readonly readSpectrum: () => SpectrumFrame | undefined
  /** Seek to an absolute time in seconds (e.g. a marker). */
  readonly seekToSeconds: (seconds: number) => void
  /** Seek to a fraction (0–1) of the timeline — what a waveform click yields. */
  readonly seekToRatio: (ratio: number) => void
  /** Whether the loupe wraps playback (vs playing through) — flips the atom. */
  readonly toggleLoop: () => void
  /** Arm/stop the speed-trainer ramp (its state rides the trainer's atom). */
  readonly speedTrainer: {
    readonly start: (policy: SpeedTrainerPolicy) => void
    readonly stop: () => void
  }
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
  /** Injectable in tests AND re-seated by the shell once its stack created the
   * singleton (like {@link player}) — a region's `useMixer()` reads it here. */
  readonly stemEngine?: StemPlaybackEngine
  readonly metadataReader?: TrackMetadataReader
  readonly separator?: StemSeparator
  readonly tempoDetector?: TempoDetector
  readonly chordDetector?: ChordDetector
  readonly structureDetector?: StructureDetector
  readonly trackSource?: TrackSource
  readonly projectStores?: ProjectDeps
  readonly countInPlayer?: CountInPlayer
  /** The live player, seated by the shell once created — see {@link PlayerHandle}. */
  readonly player?: PlayerHandle
}

/** Empty by default: every consumer falls back to its real adapter.
 * Exported for the Provider component only — consumers use the hook. */
export const AudioSessionContext = createContext<AudioSession>({})

/** Read the session's ports (a stable reference — never re-renders anyone). */
export function useAudioSession(): AudioSession {
  return useContext(AudioSessionContext)
}

/**
 * Reach the live player (ADR 0011). Regions render under the shell's enriched
 * session, so an absent player is a programming error, not a fallback case —
 * unlike the ports, there is no « real adapter » to create at the call site.
 */
export function usePlayerHandle(): PlayerHandle {
  const { player } = useAudioSession()
  if (player === undefined) {
    throw new Error(
      'usePlayerHandle: no player in the audio session — render under the workstation shell'
    )
  }
  return player
}
