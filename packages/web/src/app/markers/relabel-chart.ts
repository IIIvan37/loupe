import {
  type BeatGrid,
  type DetectedSection,
  relabelChartBySections
} from '@app/core'
import { sectionDisplayLabel } from './section-markers.ts'

/**
 * Relabel the chord grid's source from the detected sections — the web half of
 * S.3b. The core fold cuts the grid at the section boundaries and heads each
 * block with the section's label; the adapter's job is only to translate the
 * engine's raw vocabulary (`verse`…) to the display copy the header shows
 * (`[Couplet]`…), exactly as the section markers do. The grid's chords are kept
 * verbatim, so the key offset the caller carries stays valid.
 */
export function relabelChartFromSections(
  source: string,
  sections: readonly DetectedSection[],
  grid: BeatGrid,
  barsPerRow: number
): string {
  const named = sections.map((section) => ({
    ...section,
    label: sectionDisplayLabel(section.label)
  }))
  return relabelChartBySections(source, named, grid, barsPerRow)
}
