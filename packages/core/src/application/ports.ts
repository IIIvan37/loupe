import type { DetectedChordSpan } from '../harmony/domain/chord-detection.ts'
import type { DecodedAudio } from '../shared/decoded-audio.ts'

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
/** One read of the playing signal's magnitude spectrum (analyser bin
 * convention: bin `i` of N covers `i · sampleRate / 2N` Hz), linear scale. */
export interface SpectrumFrame {
  readonly magnitudes: ArrayLike<number>
  readonly sampleRate: number
}

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
  /**
   * Release the loaded track's audio. The engine goes inert (play/seek are
   * no-ops) but keeps its transport settings; a later `load` brings it back.
   * Lets a caller drop the single-track PCM while another engine (the stem
   * mix) drives the transport.
   */
  unload(): void
  /** Subscribe to position updates (seconds). Returns an unsubscribe function. */
  onPositionChange(listener: (seconds: number) => void): () => void
  /** The current output spectrum, when the adapter can tap it (browser). */
  spectrum?(): SpectrumFrame | undefined
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
/**
 * Per-stem tone shaping: cut the lows below `lowCutHz` and/or the highs above
 * `highCutHz`. An absent side is neutral. A listening aid — never persisted.
 */
export interface StemFilter {
  readonly lowCutHz?: number
  readonly highCutHz?: number
}

export interface StemPlaybackEngine {
  /**
   * Load the stems as the current multitrack source, ready from the start.
   * From the moment the call is handed over (before it resolves), `stemAudio`
   * must serve every loaded id — callers release their own copy of the PCM
   * right after calling.
   */
  load(stems: readonly StemSource[]): Promise<void>
  /** Add one stem to the running mix, joining in sync at the current position. */
  addStem(stem: StemSource): Promise<void>
  /** Drop one stem from the mix, leaving the rest playing. */
  removeStem(id: string): void
  play(): void
  pause(): void
  seekTo(seconds: number): void
  setTimeRatio(ratio: number): void
  setPitchSemitones(semitones: number): void
  /** Set one channel's linear output gain (0 = silent). */
  setGain(id: string, gain: number): void
  /**
   * Read one loaded stem's PCM back, or `undefined` when it is not loaded. The
   * engine is the PCM's only custodian — consumers (export, save) re-derive the
   * samples from here instead of retaining their own copy, and must treat the
   * returned channels as read-only views into the engine's buffers.
   */
  stemAudio(id: string): DecodedAudio | undefined
  /** Subscribe to position updates (seconds). Returns an unsubscribe function. */
  onPositionChange(listener: (seconds: number) => void): () => void
  /** The current output spectrum, when the adapter can tap it (browser). */
  spectrum?(): SpectrumFrame | undefined
  /** Apply a stem's tone filter, when the adapter supports it (browser). */
  setStemFilter?(id: string, filter: StemFilter): void
}

/**
 * Driven port: estimate a track's chords from decoded PCM, as timestamped
 * spans — NOT beat-synchronised; folding them onto the beat grid is the core's
 * job (`chordLabelPerMeasure`). Implemented by an adapter (web: an HTTP call to
 * the local server running a chord estimator); the pure core never runs the
 * DSP, and the audio is the SAME PCM the player loaded. The adapter translates
 * engine syntax (e.g. mir `A:min`) into the grid's chord tokens (`Am`) and
 * reports spans in order, non-overlapping — overlaps would inflate the
 * per-measure vote.
 */
export interface ChordDetector {
  detect(
    audio: DecodedAudio,
    /** Cooperative cancellation — an aborted run should reject promptly. */
    signal?: AbortSignal
  ): Promise<readonly DetectedChordSpan[]>
}

/** Metadata a media source reports, used to pre-fill the imported project's name. */
export interface TrackSourceMetadata {
  readonly title: string
  /** Track length in seconds, when the source reports it. */
  readonly durationSeconds?: number
  /** The uploading artist/channel, when the source reports it. */
  readonly artist?: string
}

/** A downloaded track: the encoded audio bytes (feed straight into `loadTrack`) + its metadata. */
export interface FetchedTrack {
  readonly bytes: ArrayBuffer
  readonly metadata: TrackSourceMetadata
}

/** A progress update from a running download: which phase, and how far in. */
export interface DownloadProgress {
  /** `downloading` = pulling bytes over the network; `transcoding` = extracting audio. */
  readonly phase: 'downloading' | 'transcoding'
  /** Completion of the current phase in [0, 1]. */
  readonly fraction: number
}

/**
 * Driven port: fetch a track from a media URL (YouTube / SoundCloud) as encoded
 * audio bytes + metadata. Long-running and progressive — it streams
 * phase/fraction through `onProgress`. Implemented by an adapter (web: an HTTP
 * NDJSON client against the local server running yt-dlp); the pure core never
 * knows the transport, nor that the bytes were parked in a content-addressed
 * store on the way. A cloud API could be a later adapter on the same port.
 */
export interface TrackSource {
  fetch(
    url: string,
    onProgress: (progress: DownloadProgress) => void,
    /** Cooperative cancellation — an aborted run should reject promptly. */
    signal?: AbortSignal
  ): Promise<FetchedTrack>
}
