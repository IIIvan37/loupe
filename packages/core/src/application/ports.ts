import type { LoopLibrary } from '../domain/loop-library.ts'
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

/**
 * Driven port: persist the saved-loop library across sessions. Implemented by an
 * adapter (web: localStorage); the pure core never touches storage.
 */
export interface LoopStore {
  load(): Promise<LoopLibrary>
  save(library: LoopLibrary): Promise<void>
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
