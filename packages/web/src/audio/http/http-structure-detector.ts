import {
  type DecodedAudio,
  type DetectedSection,
  StructureDetectionError,
  type StructureDetector
} from '@app/core'
import { postWavForJson, rethrowTransportError } from './post-wav-json.ts'

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
  baseUrl: string,
  /** Resolves the bearer to send, or undefined for the token-less local server.
   * Async + read per call so each upload uses the freshly-minted token (J2). */
  tokenProvider?: () => Promise<string | undefined>
): StructureDetector {
  return {
    async detect(
      audio: DecodedAudio,
      signal?: AbortSignal
    ): Promise<readonly DetectedSection[]> {
      const token = tokenProvider ? await tokenProvider() : undefined
      let body: Partial<StructureResponse>
      try {
        body = (await postWavForJson(
          baseUrl,
          '/structure',
          audio,
          signal,
          token
        )) as Partial<StructureResponse>
      } catch (e) {
        rethrowTransportError(
          e,
          (failure, detail) => new StructureDetectionError(failure, detail)
        )
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
