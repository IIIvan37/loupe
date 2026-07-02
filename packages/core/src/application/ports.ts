import type { AudioRef, Project } from '../domain/project.ts'
import type { SeparationPhase } from '../domain/separation.ts'

/**
 * Raw decoded PCM: one array of samples (normalised to [-1, 1]) per channel,
 * every channel the same length. The shape the Web Audio `AudioBuffer` exposes.
 */
export interface DecodedAudio {
  readonly sampleRate: number
  readonly channels: ReadonlyArray<ArrayLike<number>>
}

/**
 * Driven port: turn encoded audio bytes into PCM. Implemented by an adapter
 * (web: `decodeAudioData`); the pure core never touches Web Audio itself.
 */
export interface AudioFileDecoder {
  decode(bytes: ArrayBuffer): Promise<DecodedAudio>
}

/**
 * Driven port: real-time playback of decoded audio. Commands are fire-and-forget;
 * the actual elapsed position streams back through `onPositionChange`. Implemented
 * by an adapter (web: an `AudioBufferSourceNode`); the core stays timer-free.
 */
export interface PlaybackEngine {
  /** Make `audio` the current track, ready to play from its start. */
  load(audio: DecodedAudio): Promise<void>
  play(): void
  pause(): void
  seekTo(seconds: number): void
  /** Set the tempo as a ratio of normal speed, without changing pitch. */
  setTimeRatio(ratio: number): void
  /** Transpose by a whole number of semitones, without changing tempo. */
  setPitchSemitones(semitones: number): void
  /** Subscribe to position updates (seconds). Returns an unsubscribe function. */
  onPositionChange(listener: (seconds: number) => void): () => void
}

/** Tags read from a file (ID3 etc.); each field is absent when the file omits it. */
export interface TrackMetadata {
  readonly title: string | undefined
  readonly artist: string | undefined
}

/**
 * Driven port: extract embedded tags from encoded audio bytes. Best-effort — a
 * tagless or unparsable file yields empty fields, never an error. Implemented by
 * an adapter (web: music-metadata); the core stays format-agnostic.
 */
export interface TrackMetadataReader {
  read(bytes: ArrayBuffer): Promise<TrackMetadata>
}

/**
 * Driven port: persist the light project manifests (`Project` — refs, loops,
 * markers, mixer; never audio bytes). Implemented by an adapter (Tauri FS or
 * HTTP server — decided at J3.3); the pure core never knows which. `load`
 * resolves to `undefined` for an unknown id.
 */
export interface ProjectStore {
  list(): Promise<readonly Project[]>
  load(id: string): Promise<Project | undefined>
  save(project: Project): Promise<void>
  delete(id: string): Promise<void>
}

/**
 * Driven port: persist the heavy audio bytes a project only points at. `put`
 * mints the `AudioRef` — its spelling (a path, a key, a URL) is the adapter's
 * business. `get` resolves to `undefined` for an unknown ref.
 *
 * Adapters should content-address refs (same bytes → same ref): a re-save then
 * re-points at the existing blob instead of duplicating it, and blobs orphaned
 * by a failed or superseding save stay collectible by a manifest-scan GC —
 * there is deliberately no `delete` here, so reclamation is the adapter's job.
 */
export interface ProjectAudioStore {
  put(bytes: ArrayBuffer): Promise<AudioRef>
  get(ref: AudioRef): Promise<ArrayBuffer | undefined>
}

/** One isolated source the separator produced — raw PCM, like a mini `DecodedAudio`. */
export interface SeparatedStem {
  readonly id: string
  readonly label: string
  readonly audio: DecodedAudio
}

/** A progress update from a running separation: which phase, and how far in. */
export interface SeparationProgress {
  readonly phase: SeparationPhase
  /** Completion of the current phase in [0, 1]. */
  readonly fraction: number
}

/** One stem loaded into the mixer: its id (matching the `MixerState` channel) and PCM. */
export interface StemSource {
  readonly id: string
  readonly audio: DecodedAudio
}

/**
 * Driven port: synchronised multitrack playback of separated stems through a
 * per-stem gain graph summed to a master output (web: a `GainNode` per stem →
 * one SoundTouch master bus). It is the `PlaybackEngine`'s multitrack sibling —
 * same transport surface (play/pause/seek/tempo/pitch/position) — so the unified
 * transport can steer it once stems exist, plus a `setGain` per channel the
 * mixer drives. The pure core never touches Web Audio; gains are the linear
 * values `effectiveGains` produced.
 */
export interface StemPlaybackEngine {
  /** Load the stems as the current multitrack source, ready from the start. */
  load(stems: readonly StemSource[]): Promise<void>
  play(): void
  pause(): void
  seekTo(seconds: number): void
  setTimeRatio(ratio: number): void
  setPitchSemitones(semitones: number): void
  /** Set one channel's linear output gain (0 = silent). */
  setGain(id: string, gain: number): void
  /** Subscribe to position updates (seconds). Returns an unsubscribe function. */
  onPositionChange(listener: (seconds: number) => void): () => void
}

/**
 * Driven port: split decoded audio into isolated stems. Long-running and
 * progressive — it streams phase/fraction through `onProgress`. Implemented by an
 * adapter (web: a stub now, a Demucs WASM worker next, a cloud API later); the
 * pure core never knows which, and the audio is the SAME PCM the player loaded.
 */
export interface StemSeparator {
  separate(
    audio: DecodedAudio,
    onProgress: (progress: SeparationProgress) => void
  ): Promise<readonly SeparatedStem[]>
}
