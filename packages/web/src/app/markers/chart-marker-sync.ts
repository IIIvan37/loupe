import { type BeatGrid, chartSectionAnchors } from '@app/core'
import type { Markers } from './use-markers.ts'

/**
 * The chart→timeline half of the marker sync: re-derive the structure markers
 * from the edited chart source (its `[Section]` headers are the authority —
 * hand edits to structure markers are overwritable by design). Wired to USER
 * edits only (typing, a seated draft) — never to a project restore, so a saved
 * hand-fix survives reopening untouched. Without a downbeat nothing can be
 * derived, so the markers are left alone: a no-grid detection's seconds-based
 * markers must not be wiped by typing in the grid.
 */
export function syncStructureMarkersFromChart(
  source: string,
  grid: BeatGrid,
  markers: Pick<Markers, 'setSections'>
): void {
  if (!grid.some((beat) => beat.downbeat)) {
    return
  }
  markers.setSections(chartSectionAnchors(source, grid))
}
