import type {
  AudioFileDecoder,
  ChordDetector,
  CountIn,
  DecodedAudio,
  LoopRegion,
  PlaybackEngine,
  ProjectDeps,
  SpectrumFrame,
  SpeedTrainerPolicy,
  SpeedTrainerSeam,
  StemFilter,
  StemPlaybackEngine,
  StemSeparator,
  StemSource,
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
  /** Seat/adjust/clear the loupe (the player's seat-and-re-arm semantics —
   * clearing also ends the practice ramp). The armed region itself is view
   * state, read from the player's atoms. */
  readonly setLoopRegion: (region: LoopRegion | undefined) => void
  /** Arm/stop the speed-trainer ramp (its state rides the trainer's atom).
   * `cross` names a session seam — the core's single rule decides whether the
   * ramp survives it (a caller never decides to stop on its own). */
  readonly speedTrainer: {
    readonly start: (policy: SpeedTrainerPolicy) => void
    readonly stop: () => void
    readonly cross: (seam: SpeedTrainerSeam) => void
  }
}

/**
 * The stems' PCM custodian — the ONE member of the stem engine's surface the
 * separation needs: it reads samples back zero-copy for export and save, and
 * retains none. Declared HERE, shaped by its consumer, instead of that
 * consumer importing the core's thirteen-member `StemPlaybackEngine` (DIP —
 * the seam declares, the adapter satisfies it structurally, like
 * {@link CountInPlayer}). The engine keeps its identity: what narrows is who
 * sees what, never the object handed over.
 */
export interface StemAudioSource {
  /** One loaded stem's PCM, or undefined when it is not loaded. */
  readonly stemAudio: (id: string) => DecodedAudio | undefined
}

/**
 * The live gain graph — the second disjoint slice of the stem engine's surface
 * (five members of thirteen): what the mixer drives when a fader, a mute, a solo
 * or a fresh separation changes what is heard. It knows nothing of the transport
 * (the mixer never starts playback) nor of PCM custody (that is
 * {@link StemAudioSource}). Declared HERE, shaped by `useMixer`, so the mixer
 * stops naming the core's thirteen-member `StemPlaybackEngine` (DIP — the seam
 * declares, the adapter satisfies it structurally, like {@link CountInPlayer}).
 */
export interface StemMixGraph {
  /** Load these stems' PCM as the current mix (every channel back at unity). */
  readonly load: (stems: readonly StemSource[]) => Promise<void>
  /** Add one stem to the running mix, joining in sync at the current position. */
  readonly addStem: (stem: StemSource) => Promise<void>
  /** Drop one stem from the mix, leaving the rest playing. */
  readonly removeStem: (id: string) => void
  /** Set one channel's linear output gain (0 = silent) — an `effectiveGains` value. */
  readonly setGain: (id: string, gain: number) => void
  /** Shape one stem's tone, when the adapter supports it (browser). */
  readonly setStemFilter?: (id: string, filter: StemFilter) => void
}

/**
 * The transport — the third disjoint slice, and the only one that is NOT
 * stem-specific: these seven members are exactly the surface `PlaybackEngine`
 * and `StemPlaybackEngine` share, which is why the unified transport can swap
 * one for the other mid-session. The track engine carries `load`/`unload` ON
 * TOP of it (the single-track lifecycle the hand-off drives), so it stays a
 * whole `PlaybackEngine` — only the stem side narrows. Declared HERE, shaped by
 * its consumers (`useTransportEngines`, `usePlayer`), so they stop naming the
 * core's thirteen-member `StemPlaybackEngine` (DIP — the seam declares, the
 * adapter satisfies it structurally, like {@link CountInPlayer}).
 *
 * With this one the three slices PARTITION that port: 1 ({@link StemAudioSource})
 * + 5 ({@link StemMixGraph}) + 7 = 13, every member claimed exactly once, none
 * shared between two consumers. The fat port was three roles in one interface.
 */
export interface PlaybackTransport {
  readonly play: () => void
  readonly pause: () => void
  /** Jump the playhead to an absolute time in seconds. */
  readonly seekTo: (seconds: number) => void
  /** Set the tempo as a ratio of normal speed, without changing pitch. */
  readonly setTimeRatio: (ratio: number) => void
  /** Transpose by semitones (fractional = the fine tune), without changing tempo. */
  readonly setPitchSemitones: (semitones: number) => void
  /** Subscribe to position updates (seconds). Returns an unsubscribe function. */
  readonly onPositionChange: (listener: (seconds: number) => void) => () => void
  /** The current output spectrum, when the adapter can tap it (browser). */
  readonly spectrum?: () => SpectrumFrame | undefined
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
 * Reach the stems' PCM without seeing the engine that owns it — undefined
 * until the shell seats one (no stems, nothing to read back). The engine
 * object itself is returned, narrowed: no member is extracted, so an adapter
 * whose reader closes over `this` keeps working.
 */
export function useStemAudio(): StemAudioSource | undefined {
  return useAudioSession().stemEngine
}

/**
 * Reach the live gain graph without seeing the transport that shares the same
 * engine — undefined until the shell seats one. The mixer decides what an
 * absent graph means (it throws: the mix has ONE graph, never a private one),
 * so the seam stays a reader. Like {@link useStemAudio}, the engine object is
 * returned narrowed — no member is extracted, so an adapter whose methods close
 * over `this` keeps working.
 */
export function useStemMixGraph(): StemMixGraph | undefined {
  return useAudioSession().stemEngine
}

/**
 * Reach the stem mix as a transport, without seeing the gain graph or the PCM
 * custody that share the same engine — undefined until the shell seats one, and
 * the player then drives its own adapter. Like {@link useStemAudio}, the engine
 * object is returned narrowed — no member is extracted, so an adapter whose
 * methods close over `this` keeps working.
 */
export function useStemTransport(): PlaybackTransport | undefined {
  return useAudioSession().stemEngine
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
