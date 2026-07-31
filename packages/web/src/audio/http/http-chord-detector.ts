import {
  ChordDetectionError,
  type ChordDetector,
  type DecodedAudio,
  type DetectedChordSpan
} from '@app/core'
import { postWavForJson, rethrowTransportError } from './post-wav-json.ts'

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
 * Each large-vocabulary mir quality as its lead-sheet token suffix (`min7` →
 * `m7`, `hdim7` → `m7b5`, `maj6` → `6`, `minmaj7` → `mM7`). `maj` is bare (a
 * major triad is just its root), `min` a lone `m`. A quality not in the table
 * (a future engine tag) passes through verbatim rather than being dropped.
 */
const QUALITY_TOKENS: Readonly<Record<string, string>> = {
  maj: '',
  min: 'm',
  dim: 'dim',
  aug: 'aug',
  min6: 'm6',
  maj6: '6',
  min7: 'm7',
  minmaj7: 'mM7',
  maj7: 'maj7',
  '7': '7',
  dim7: 'dim7',
  hdim7: 'm7b5',
  sus2: 'sus2',
  sus4: 'sus4'
}

/**
 * Translate one mir label into the grid's own token spelling: the `:` joins a
 * root and a quality (`A#:min` → `A#m`, `D:maj` → `D`, `C:hdim7` → `Cm7b5`),
 * and the no-chord labels read as silence. This spelling is the port's contract
 * — the pure core never sees engine syntax.
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
  return root + (QUALITY_TOKENS[quality] ?? quality) + slash
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
 * Driven adapter for `ChordDetector`: offloads chord estimation to the
 * analysis endpoint (the Modal offload when configured, else the local
 * server), which analyses the uploaded mix WAV and answers with timestamped
 * mir-syntax spans. The pure core never knows the DSP ran off-device, nor
 * that the engine speaks mir — labels arrive already translated into grid
 * tokens, silence as an absent label.
 */
export function createHttpChordDetector(
  baseUrl: string,
  /** Resolves the bearer to send, or undefined for the token-less local server.
   * Async + read per call so each upload uses the freshly-minted token (J2). */
  tokenProvider?: () => Promise<string | undefined>
): ChordDetector {
  return {
    async detect(
      audio: DecodedAudio,
      signal?: AbortSignal
    ): Promise<readonly DetectedChordSpan[]> {
      const token = tokenProvider ? await tokenProvider() : undefined
      let body: Partial<ChordsResponse>
      try {
        body = (await postWavForJson(
          baseUrl,
          '/chords',
          audio,
          signal,
          token
        )) as Partial<ChordsResponse>
      } catch (e) {
        rethrowTransportError(
          e,
          (failure, detail) => new ChordDetectionError(failure, detail)
        )
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
