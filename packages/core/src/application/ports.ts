import type { Greeting } from '../domain/greeting.ts'
import type { LoopLibrary } from '../domain/loop-library.ts'

/** Driving port: provides the input. Implemented by an adapter (cli/web/…). */
export interface NameSource {
  load(): Promise<string>
}

/** Driven port: emits/persists the result. The concrete sink is the adapter's job. */
export interface GreetingSink {
  save(greeting: Greeting): Promise<void>
}

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
