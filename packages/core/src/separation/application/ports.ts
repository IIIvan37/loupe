import type { DecodedAudio } from '../../shared/decoded-audio.ts'
import type { SeparationPhase } from '../domain/separation.ts'

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
    onProgress: (progress: SeparationProgress) => void,
    /** Cooperative cancellation — an aborted run should reject promptly. */
    signal?: AbortSignal
  ): Promise<readonly SeparatedStem[]>
}

/** One file destined for the export archive: its name and encoded bytes. */
export interface ArchiveFile {
  readonly name: string
  readonly bytes: Uint8Array
}

/**
 * Driven port: bundle named files into one downloadable archive and return its
 * bytes. Implemented by an adapter (web: a zip); the pure core never touches
 * Blob or the DOM — triggering the actual download is the adapter's business.
 */
export interface ArchiveWriter {
  write(files: readonly ArchiveFile[]): Promise<Uint8Array<ArrayBuffer>>
}
