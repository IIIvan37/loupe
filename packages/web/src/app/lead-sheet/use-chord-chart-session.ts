import type { BeatGrid, ChordDetector, DecodedAudio } from '@app/core'
import { useChordChart } from './use-chord-chart.ts'
import {
  type ChordDetection,
  useChordDetection
} from './use-chord-detection.ts'

/**
 * The chord chart's whole session surface, one hook for the shell: the source
 * text (session state — saved with the project, restored on open, cleared by a
 * fresh import; it lives above the panel, which unmounts while a track loads)
 * plus the « Détecter les accords » flow drafting into that same source, so a
 * detection persists exactly like a manual edit.
 */
export function useChordChartSession({
  loadedAudio,
  grid,
  detector
}: {
  readonly loadedAudio: DecodedAudio | undefined
  readonly grid: BeatGrid
  readonly detector?: ChordDetector | undefined
}): {
  readonly chart: ReturnType<typeof useChordChart>
  readonly detection: ChordDetection
} {
  const chart = useChordChart()
  const detection = useChordDetection({
    loadedAudio,
    grid,
    // A landed draft is in the track's own key — it resets the key offset.
    onDraft: chart.seatDraft,
    detector
  })
  return { chart, detection }
}
