import {
  ChordDetectionError,
  type ChordDetector,
  type DecodedAudio,
  type DetectedChordSpan
} from '@app/core'
import { classifyTransportError, postWavForJson } from './post-wav-json.ts'

/** One span as the chords endpoint reports it: mir label over [start, end). */
interface WireSpan {
  readonly start: number
  readonly end: number
  readonly label: string
}

/** The chords endpoint's JSON shape. */
interface ChordsResponse {
  readonly chords: readonly WireSpan[]
}

/** mir's no-chord (`N`) and unknown (`X`) labels — silence to the grid. */
const SILENCE_LABELS = new Set(['N', 'X'])

/**
 * Translate one mir label into the grid's own token spelling: the `:` joins a
 * root and a quality (`A#:min` → `A#m`, `D:maj` → `D`, `G:7` → `G7`), and the
 * no-chord labels read as silence. This spelling is the port's contract — the
 * pure core never sees engine syntax.
 */
function toGridToken(label: string): string | undefined {
  if (SILENCE_LABELS.has(label)) {
    return undefined
  }
  const colon = label.indexOf(':')
  if (colon === -1) {
    return label
  }
  const root = label.slice(0, colon)
  // A large-vocabulary label may carry an inversion (`C:maj/3`) — split the
  // bass off so the quality mapping never swallows it.
  const [quality = '', ...bass] = label.slice(colon + 1).split('/')
  const slash = bass.length > 0 ? `/${bass.join('/')}` : ''
  if (quality === 'min') {
    return `${root}m${slash}`
  }
  if (quality === 'maj') {
    return root + slash
  }
  return root + quality + slash
}

function isWireSpan(value: unknown): value is WireSpan {
  const span = value as Partial<WireSpan>
  return (
    typeof span === 'object' &&
    span !== null &&
    typeof span.start === 'number' &&
    typeof span.end === 'number' &&
    typeof span.label === 'string'
  )
}

/**
 * Driven adapter for `ChordDetector`: offloads chord estimation to the local
 * server (the same one that runs Demucs), which analyses the uploaded mix WAV
 * and answers with timestamped mir-syntax spans. The pure core never knows the
 * DSP ran off-device, nor that the engine speaks mir — labels arrive already
 * translated into grid tokens, silence as an absent label.
 */
export function createHttpChordDetector(baseUrl: string): ChordDetector {
  return {
    async detect(
      audio: DecodedAudio,
      signal?: AbortSignal
    ): Promise<readonly DetectedChordSpan[]> {
      let body: Partial<ChordsResponse>
      try {
        body = (await postWavForJson(
          baseUrl,
          '/chords',
          audio,
          signal
        )) as Partial<ChordsResponse>
      } catch (e) {
        // Translate the shared transport failures into the port's typed
        // error; anything unclassified stays untyped → the unknown code.
        const failure = classifyTransportError(e)
        if (failure !== undefined && e instanceof Error) {
          throw new ChordDetectionError(failure, e.message)
        }
        throw e
      }
      if (!Array.isArray(body.chords) || !body.chords.every(isWireSpan)) {
        throw new Error('chords response was malformed')
      }
      return body.chords.map((span) => ({
        startSeconds: span.start,
        endSeconds: span.end,
        label: toGridToken(span.label)
      }))
    }
  }
}
