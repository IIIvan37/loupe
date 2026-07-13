import type { BeatGrid, DecodedAudio, StructureDetector } from '@app/core'
import {
  DEFAULT_BARS_PER_ROW,
  readStoredBarsPerRow
} from '../lead-sheet/bars-per-row-preference.ts'
import { relabelChartFromSections } from './relabel-chart.ts'
import { sectionMarkers } from './section-markers.ts'
import type { Markers } from './use-markers.ts'
import {
  type StructureDetection,
  useStructureDetection
} from './use-structure-detection.ts'

/**
 * Wire « Détecter la structure » to the marker list AND the chord grid: run the
 * detection, then replace the markers with the detected sections (raw engine
 * labels translated to display copy) and, when a grid already exists, relabel
 * it — the neutral `[A]`/`[B]` give way to the detected `[Couplet]`/`[Refrain]`
 * (S.3b). One hook for the shell, keeping both mappings out of the top-level
 * component. Independent of the chord grid: an empty grid just skips the
 * relabel (and the snap), so the button still works before the tempo is known.
 */
export function useStructureMarkers({
  loadedAudio,
  grid,
  markers,
  chart,
  detector
}: {
  readonly loadedAudio: DecodedAudio | undefined
  readonly grid: BeatGrid
  readonly markers: Markers
  /** The chord grid's lifted source — relabelled in place when it has content.
   * `setSource` keeps the key offset (the chords are unchanged), unlike a draft. */
  readonly chart: {
    readonly source: string
    readonly setSource: (source: string) => void
  }
  readonly detector?: StructureDetector | undefined
}): StructureDetection {
  return useStructureDetection({
    loadedAudio,
    grid,
    onSections: (sections) => {
      markers.setSections(sectionMarkers(sections))
      // Relabel only a grid that has content and a grid to place bars on — the
      // confirm the control armed already covers this overwrite.
      if (chart.source.trim() !== '' && grid.some((beat) => beat.downbeat)) {
        chart.setSource(
          relabelChartFromSections(
            chart.source,
            sections,
            grid,
            readStoredBarsPerRow() ?? DEFAULT_BARS_PER_ROW
          )
        )
      }
    },
    detector
  })
}
