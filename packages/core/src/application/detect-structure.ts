import {
  type DetectedSection,
  snapSectionsToGrid
} from '../domain/song-structure.ts'
import type { BeatGrid } from '../rhythm/domain/beat-grid.ts'
import type { DecodedAudio } from '../shared/decoded-audio.ts'
import { errorMessage } from '../shared/error-message.ts'
import type { StructureDetector } from './ports.ts'

export interface DetectStructureInput {
  /** The already-decoded track — the SAME PCM the player loaded, not a re-import. */
  readonly audio: DecodedAudio
  /** The beat grid the section boundaries snap onto. May be empty (no tempo
   * detected yet) — the sections then pass through unsnapped, so the structure
   * button works before the chord grid exists. */
  readonly grid: BeatGrid
  /** Cooperative cancellation, forwarded to the detector port. */
  readonly signal?: AbortSignal
}

export interface DetectStructureDeps {
  readonly detector: StructureDetector
}

/**
 * Why a structure detection failed, discriminated so the UI can speak each case
 * in the user's language (Lot G standard) instead of echoing raw engine text.
 */
export type StructureDetectionErrorCode =
  | 'no-structure'
  | 'engine-unavailable'
  | 'network'
  | 'timeout'
  | 'too-large'
  | 'unknown'

/**
 * The typed failure a `StructureDetector` adapter throws when it can tell WHY
 * the engine call failed (server up but model missing, network unreachable,
 * analysis timed out, upload over the server's cap). The use-case forwards the
 * code; anything else it catches folds into `unknown`.
 */
export class StructureDetectionError extends Error {
  readonly code: 'engine-unavailable' | 'network' | 'timeout' | 'too-large'

  constructor(
    code: 'engine-unavailable' | 'network' | 'timeout' | 'too-large',
    detail: string
  ) {
    super(detail)
    this.code = code
    this.name = 'StructureDetectionError'
  }
}

export type DetectStructureResult =
  | { readonly ok: true; readonly sections: readonly DetectedSection[] }
  | {
      readonly ok: false
      readonly code: StructureDetectionErrorCode
      /** The raw engine/transport message — for the console, never the UI. */
      readonly detail: string
    }

/**
 * Orchestration use-case, pure: hand the loaded PCM to the structure detector
 * port and snap the sections it returns onto the beat grid
 * (`snapSectionsToGrid`) so they start on measures — the draft of structure
 * markers the user then corrects. Unlike chord detection this does NOT require
 * a grid: the « detect structure » button places markers even before the tempo
 * is known, so an empty grid just skips snapping. A detection yielding no
 * sections is an error — there is nothing to mark.
 */
export async function detectStructure(
  input: DetectStructureInput,
  deps: DetectStructureDeps
): Promise<DetectStructureResult> {
  try {
    const sections = await deps.detector.detect(input.audio, input.signal)
    // A broken section (an adapter parsing a malformed number, a zero-/
    // negative-length span, a missing label) must surface as an error, not
    // become a garbage marker — especially on the gridless path, where no
    // snapping runs to clean it up.
    const valid = sections.every(
      (section) =>
        Number.isFinite(section.startSeconds) &&
        Number.isFinite(section.endSeconds) &&
        section.endSeconds > section.startSeconds &&
        typeof section.label === 'string' &&
        section.label.length > 0
    )
    if (!valid) {
      return {
        ok: false,
        code: 'unknown',
        detail: 'invalid structure detection'
      }
    }
    if (sections.length === 0) {
      return {
        ok: false,
        code: 'no-structure',
        detail: 'no structure detected'
      }
    }
    return { ok: true, sections: snapSectionsToGrid(sections, input.grid) }
  } catch (e) {
    const code = e instanceof StructureDetectionError ? e.code : 'unknown'
    return { ok: false, code, detail: errorMessage(e) }
  }
}
