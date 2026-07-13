import type { BeatGrid, DecodedAudio, StructureDetector } from '@app/core'
import { sectionMarkers } from './section-markers.ts'
import type { Markers } from './use-markers.ts'
import {
  type StructureDetection,
  useStructureDetection
} from './use-structure-detection.ts'

/**
 * Wire « Détecter la structure » to the marker list: run the detection, then
 * replace the markers with the detected sections (raw engine labels translated
 * to display copy). One hook for the shell — it keeps the section-marker
 * mapping out of the top-level component, mirroring `useChordChartSession`.
 * Independent of the chord grid: an empty grid just skips the downbeat snap, so
 * the button works before the tempo is known.
 */
export function useStructureMarkers({
  loadedAudio,
  grid,
  markers,
  detector
}: {
  readonly loadedAudio: DecodedAudio | undefined
  readonly grid: BeatGrid
  readonly markers: Markers
  readonly detector?: StructureDetector | undefined
}): StructureDetection {
  return useStructureDetection({
    loadedAudio,
    grid,
    onSections: (sections) => markers.setSections(sectionMarkers(sections)),
    detector
  })
}
