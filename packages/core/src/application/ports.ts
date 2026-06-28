import type { Greeting } from '../domain/greeting.ts'

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
  /** Subscribe to position updates (seconds). Returns an unsubscribe function. */
  onPositionChange(listener: (seconds: number) => void): () => void
}
