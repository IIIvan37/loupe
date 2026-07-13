import {
  type DecodedAudio,
  type DetectedSection,
  StructureDetectionError,
  type StructureDetector
} from '@app/core'
import { classifyTransportError, postWavForJson } from './post-wav-json.ts'

/** One section as the structure endpoint reports it: a raw label over [start, end). */
interface WireSegment {
  readonly start: number
  readonly end: number
  readonly label: string
}

/** The structure endpoint's JSON shape. */
interface StructureResponse {
  readonly segments: readonly WireSegment[]
}

function isWireSegment(value: unknown): value is WireSegment {
  const segment = value as Partial<WireSegment>
  return (
    typeof segment === 'object' &&
    segment !== null &&
    typeof segment.start === 'number' &&
    typeof segment.end === 'number' &&
    typeof segment.label === 'string'
  )
}

/**
 * Driven adapter for `StructureDetector`: offloads structure estimation to the
 * local server (the same one that runs Demucs), which analyses the uploaded mix
 * WAV and answers with contiguous, timestamped sections in its own vocabulary
 * (`verse`, `chorus`…). The pure core never knows the DSP ran off-device;
 * unlike chords the labels pass through untouched — mapping the engine's
 * vocabulary to display copy is the UI's job (Lingui), mirroring how the core's
 * `StructureDetector` port documents the contract.
 */
export function createHttpStructureDetector(
  baseUrl: string
): StructureDetector {
  return {
    async detect(
      audio: DecodedAudio,
      signal?: AbortSignal
    ): Promise<readonly DetectedSection[]> {
      let body: Partial<StructureResponse>
      try {
        body = (await postWavForJson(
          baseUrl,
          '/structure',
          audio,
          signal
        )) as Partial<StructureResponse>
      } catch (e) {
        // Translate the shared transport failures into the port's typed error;
        // anything unclassified stays untyped → the use-case's unknown code.
        const failure = classifyTransportError(e)
        if (failure !== undefined && e instanceof Error) {
          throw new StructureDetectionError(failure, e.message)
        }
        throw e
      }
      if (
        !Array.isArray(body.segments) ||
        !body.segments.every(isWireSegment)
      ) {
        throw new Error('structure response was malformed')
      }
      return body.segments.map((segment) => ({
        startSeconds: segment.start,
        endSeconds: segment.end,
        label: segment.label
      }))
    }
  }
}
