import type { LoopLibrary } from './loop-library.ts'
import type { LoopRegion } from './loop-region.ts'
import type { MarkerList } from './marker-list.ts'
import type { MixerChannel, MixerState } from './mixer.ts'
import type { BeatGrid, ManualTempo } from './tempo.ts'

/**
 * An opaque pointer to audio bytes that live outside the hexagon — the original
 * file or a separated stem. A project never holds raw PCM; it holds this
 * reference, which a `ProjectAudioStore` adapter resolves to bytes. Its exact
 * spelling (a path, a key, a URL) is the adapter's business, not the core's.
 */
export type AudioRef = string

/** The imported track a project is built around: its tags plus a pointer to its bytes. */
export interface ProjectSource {
  readonly title: string | undefined
  readonly artist: string | undefined
  readonly audioRef: AudioRef
}

/** One separated stem as persisted: its identity and a pointer to its WAV bytes (no PCM). */
export interface ProjectStem {
  readonly id: string
  readonly label: string
  readonly audioRef: AudioRef
}

/**
 * The armed A/B region — the « loupe » itself — as the user left it. Distinct
 * from the saved-loop library: a region being worked needs no name to be worth
 * keeping, and losing it on save is losing the very thing being practised.
 */
export interface ProjectActiveLoop {
  readonly region: LoopRegion
  /** Whether playback wraps at the region end (vs playing through). */
  readonly enabled: boolean
}

/**
 * The playback tuning as the user left it — how the track is being practised:
 * tempo ratio, pitch shift and view magnification. Values are the same scalars
 * the transport clamps (`clampPlaybackRate` / `clampPitchSemitones` /
 * `clampZoom`); a reader restoring a manifest re-clamps through those.
 */
export interface ProjectTuning {
  /** Tempo as a ratio of normal speed (1 = 100 %). */
  readonly timeRatio: number
  /** Pitch shift in whole semitones (0 = original key). */
  readonly pitchSemitones: number
  /** View magnification (1× = fully zoomed out). */
  readonly zoom: number
}

/**
 * The tempo half of a project: the detected analysis (BPM + downbeat-flagged
 * beat grid) so a reopen restores the beat grid and re-synthesises the metronome
 * click without re-running detection, plus the metronome stem's own mixer
 * settings (dB / mute / solo) as the user left them. The click PCM itself is
 * never stored — it is re-synthesised from the grid and the re-imported audio.
 */
export interface ProjectTempo {
  readonly bpm: number
  readonly grid: BeatGrid
  /**
   * The detected meter (beats per bar). Absent ⇔ common time (4) on manifests
   * that predate the enriched tempo contract, which had no meter.
   */
  readonly beatsPerBar?: number
  /** The metronome mixer channel as the user left it (its id is the caller's). */
  readonly metronome: MixerChannel
  /**
   * Manual octave correction applied on top of the detection: +1 per ×2, −1 per
   * ÷2. The bpm/grid above are already folded; this is kept so a reopen signs
   * identically (the fold is a user edit) and never re-detects it. Absent ⇔ 0 on
   * manifests that predate the octave toggle.
   */
  readonly octaveShift?: number
  /**
   * The user-set tempo override (typed, tapped or phase-aligned): the bpm and
   * the downbeat anchor the grid above was rebuilt from. The bpm/grid are
   * already the override's; this is kept so a reopen restores the override
   * state (further edits continue from it) and signs it as the user edit it
   * is. Absent ⇔ the analysis is the untouched detection.
   */
  readonly manual?: ManualTempo
}

/**
 * The separation half of a project: the stems produced plus the mixer settings
 * over them. The mixer's channels line up with the stems (one channel per stem
 * id). Present only once the track has been separated; absent otherwise.
 */
export interface ProjectSeparation {
  readonly stems: readonly ProjectStem[]
  readonly mixer: MixerState
}

/**
 * A saved practice project: everything needed to restore a working session, kept
 * as light data. Heavy audio stays behind `AudioRef`s; loops, markers and the
 * mixer are the pure domain values modelled elsewhere. Identity and timestamps
 * are minted by the caller — the core owns no clock and no id generator.
 */
export interface Project {
  readonly id: string
  readonly name: string
  /** Creation instant, epoch milliseconds, injected by the caller. */
  readonly createdAt: number
  /** Last-touch instant, epoch milliseconds; equals `createdAt` on a fresh project. */
  readonly updatedAt: number
  readonly source: ProjectSource
  readonly loops: LoopLibrary
  readonly markers: MarkerList
  /** Present while an A/B region was armed when the project was saved. */
  readonly activeLoop?: ProjectActiveLoop
  /** The playback tuning at save time; absent on manifests that predate it. */
  readonly tuning?: ProjectTuning
  /** The detected tempo + metronome settings; absent until a tempo is known. */
  readonly tempo?: ProjectTempo
  /** Present once the track has been separated. */
  readonly separation?: ProjectSeparation
}

/** The neutral tuning: normal speed, original key, fully zoomed out. */
const NEUTRAL_TUNING: ProjectTuning = {
  timeRatio: 1,
  pitchSemitones: 0,
  zoom: 1
}

/**
 * Normalise an optional persisted tuning: a manifest that predates the field
 * means the user had the neutral settings, so absent reads as neutral. Keeps
 * the « old manifest » rule in one place — the fingerprint and the restore
 * path must agree on it, or an untouched reopened project would read dirty.
 */
export function tuningOrDefault(
  tuning: ProjectTuning | undefined
): ProjectTuning {
  return tuning ?? NEUTRAL_TUNING
}

/**
 * The separation consistency invariant: the mixer's channels line up with the
 * stems — one channel per stem id, in any order, nothing extra on either side.
 * A caller persisting a separation checks the pair before trusting it.
 */
export function mixerMatchesStems(
  stemIds: readonly string[],
  mixer: MixerState
): boolean {
  const channelIds = new Set(mixer.map((channel) => channel.id))
  return (
    channelIds.size === stemIds.length &&
    stemIds.every((id) => channelIds.has(id))
  )
}

/**
 * A snapshot of the current working session — the raw material a project is
 * assembled from. The same shape as a `Project` minus the identity and
 * timestamps, which only come into being when it is saved.
 */
export interface SessionSnapshot {
  readonly source: ProjectSource
  readonly loops: LoopLibrary
  readonly markers: MarkerList
  /** `undefined` is accepted here so callers can pass it straight through —
   * `projectFromSession` owns the single guard that omits the key. */
  readonly activeLoop?: ProjectActiveLoop | undefined
  readonly tuning?: ProjectTuning | undefined
  readonly tempo?: ProjectTempo | undefined
  readonly separation?: ProjectSeparation
}

/** The identity and creation instant a caller stamps onto a new project. */
export interface ProjectStamp {
  readonly id: string
  readonly name: string
  /** Creation instant, epoch milliseconds. */
  readonly now: number
}

/**
 * Assemble a new `Project` from the current session snapshot and a caller-minted
 * stamp. Pure — id, name and `now` come in as values (no clock, no id
 * generator). `createdAt` and `updatedAt` both start at `now`; a later save is
 * what bumps `updatedAt`.
 */
export function projectFromSession(
  session: SessionSnapshot,
  stamp: ProjectStamp
): Project {
  return {
    id: stamp.id,
    name: stamp.name,
    createdAt: stamp.now,
    updatedAt: stamp.now,
    source: session.source,
    loops: session.loops,
    markers: session.markers,
    ...(session.activeLoop === undefined
      ? {}
      : { activeLoop: session.activeLoop }),
    ...(session.tuning === undefined ? {} : { tuning: session.tuning }),
    ...(session.tempo === undefined ? {} : { tempo: session.tempo }),
    ...(session.separation === undefined
      ? {}
      : { separation: session.separation })
  }
}
