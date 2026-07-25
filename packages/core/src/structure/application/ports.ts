import type { DecodedAudio } from '../../shared/decoded-audio.ts'
import type { DetectedSection } from '../domain/song-structure.ts'

/**
 * Driven port: estimate a track's functional structure from decoded PCM, as
 * ordered, contiguous sections in raw seconds — NOT beat-synchronised; snapping
 * the section boundaries onto the beat grid is the core's job
 * (`snapSectionsToGrid`). Implemented by an adapter (web: an HTTP call to the
 * local server running the segmentation model); the pure core never runs the
 * DSP, and the audio is the SAME PCM the player loaded. The adapter labels each
 * section in the model's raw vocabulary (`verse`, `chorus`…) — translating to
 * display copy is the UI's job, mirroring how the chord detector ships raw spans.
 */
export interface StructureDetector {
  detect(
    audio: DecodedAudio,
    /** Cooperative cancellation — an aborted run should reject promptly. */
    signal?: AbortSignal
  ): Promise<readonly DetectedSection[]>
}
