import type { SeparatedStem } from '@app/core'
import { type StereoChannels, TARGET_SAMPLE_RATE } from './audio-format.ts'

/**
 * Display order + labels for the four htdemucs stems, shared by every separator
 * adapter. `source` is the stem's index in the model output order [drums, bass,
 * other, vocals]; we reorder to a musician-friendly lineup and tag with the
 * reserved French labels. (Richer, adaptive detection is Slice J2.3.)
 */
const STEMS: ReadonlyArray<{
  readonly id: string
  readonly label: string
  readonly source: number
}> = [
  { id: 'voix', label: 'Voix', source: 3 },
  { id: 'batterie', label: 'Batterie', source: 0 },
  { id: 'basse', label: 'Basse', source: 1 },
  { id: 'autres', label: 'Autres', source: 2 }
]

/** Map the engine's raw ordered stems into labelled, display-ordered `SeparatedStem`s. */
export function toSeparatedStems(
  raw: ReadonlyArray<StereoChannels>
): SeparatedStem[] {
  return STEMS.map((stem): SeparatedStem => {
    const source = raw[stem.source]
    return {
      id: stem.id,
      label: stem.label,
      audio: {
        sampleRate: TARGET_SAMPLE_RATE,
        channels: [
          source?.left ?? new Float32Array(0),
          source?.right ?? new Float32Array(0)
        ]
      }
    }
  })
}
