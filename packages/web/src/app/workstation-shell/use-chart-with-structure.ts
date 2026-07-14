import type {
  ChordDetector,
  DecodedAudio,
  StructureDetector,
  TempoAnalysis
} from '@app/core'
import { useChordChartSession } from '../lead-sheet/use-chord-chart-session.ts'
import type { ChordDetection } from '../lead-sheet/use-chord-detection.ts'
import { syncStructureMarkersFromChart } from '../markers/chart-marker-sync.ts'
import { markerSections } from '../markers/section-markers.ts'
import type { Markers } from '../markers/use-markers.ts'
import type { StructureDetection } from '../markers/use-structure-detection.ts'
import { useStructureMarkers } from '../markers/use-structure-markers.ts'

/**
 * The chart ↔ structure pairing, off the shell: the chart session (edits +
 * « Détecter les accords ») is built FIRST because the structure flow relabels
 * that same source (S.3b), and every user edit of the source re-derives the
 * structure markers (chart = authority). Both flows read the same grid and the
 * same felt bar length, so the pairing owns that plumbing too.
 */
export function useChartWithStructure({
  loadedAudio,
  analysis,
  markers,
  chordDetector,
  structureDetector
}: {
  readonly loadedAudio: DecodedAudio | undefined
  readonly analysis: TempoAnalysis | undefined
  readonly markers: Markers
  readonly chordDetector?: ChordDetector | undefined
  readonly structureDetector?: StructureDetector | undefined
}): {
  readonly chordChart: ReturnType<typeof useChordChartSession>['chart']
  readonly chordDetection: ChordDetection
  readonly structureDetection: StructureDetection
} {
  const grid = analysis?.grid ?? []
  const beatsPerBar = analysis?.beatsPerBar
  const { chart: chordChart, detection: chordDetection } = useChordChartSession(
    {
      loadedAudio,
      grid,
      beatsPerBar,
      // A structure already on the timeline cuts the detected draft — the
      // reverse order (chords first) leaves this empty and the draft deduces.
      sections: markerSections(markers.markers),
      detector: chordDetector,
      onSourceEdited: (source) =>
        syncStructureMarkersFromChart(source, grid, markers)
    }
  )
  const structureDetection = useStructureMarkers({
    loadedAudio,
    grid,
    beatsPerBar,
    markers,
    chart: chordChart,
    detector: structureDetector
  })
  return { chordChart, chordDetection, structureDetection }
}
