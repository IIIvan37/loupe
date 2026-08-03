import {
  type BeatGrid,
  type DetectedSection,
  parseChart,
  relabelChartBySections
} from '@app/core'
import { sectionDisplayLabel } from './section-markers.ts'

/** The whole song as one unnamed block — rendering it relabels to a flat,
 * headerless chart (a lone unheaded run prints no `[…]` line). */
const wholeSong: DetectedSection = {
  startSeconds: 0,
  endSeconds: Number.POSITIVE_INFINITY,
  label: ''
}

/**
 * Relabel the chord grid's source from the KNOWN sections — a detection's
 * result (S.3b) or the timeline's structure markers after a hand edit. The
 * core fold cuts the grid at the section boundaries and heads each block with
 * the section's label; the adapter's job is only to translate the engine's raw
 * vocabulary (`verse`…) to the display copy the header shows (`[Couplet]`…),
 * exactly as the section markers do. The grid's chords are kept verbatim, so
 * the key offset the caller carries stays valid.
 *
 * The sections are authoritative, so the headers must mirror them exactly:
 * a lone section keeps its header (`headLoneRun` — suppressing it would erase
 * the marker at the next chart→marker sync), and NO section strips the
 * headers entirely (a stale one would resurrect the removed marker). A chart
 * that already has no header has nothing to strip and passes through
 * verbatim, keeping the user's own formatting.
 */
export function relabelChartFromSections(
  source: string,
  sections: readonly DetectedSection[],
  grid: BeatGrid,
  barsPerRow: number,
  beatsPerBar?: number
): string {
  if (sections.length === 0) {
    const headed = parseChart(source).sections.some(
      (chartSection) => (chartSection.label ?? '') !== ''
    )
    return headed
      ? relabelChartBySections(
          source,
          [wholeSong],
          grid,
          barsPerRow,
          beatsPerBar
        )
      : source
  }
  const named = sections.map((section) => ({
    ...section,
    label: sectionDisplayLabel(section.label)
  }))
  return relabelChartBySections(
    source,
    named,
    grid,
    barsPerRow,
    beatsPerBar,
    true
  )
}
