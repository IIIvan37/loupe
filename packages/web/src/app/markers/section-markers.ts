import type { DetectedSection, MarkerList } from '@app/core'
import { i18n } from '../../i18n/i18n.ts'
import { sectionLabelDescriptor } from './section-label.ts'

/** A section marker point: a translated label at the section's start. */
export interface SectionMarker {
  readonly timeSeconds: number
  readonly label: string
}

/**
 * A raw engine section label (`verse`…) as display copy, resolved through the
 * shared i18n singleton (like the auto marker name). An unknown label passes
 * through verbatim so a new engine tag is still shown, not dropped. Shared by
 * the section markers and the grid relabelling, so both name a section alike.
 */
export function sectionDisplayLabel(raw: string): string {
  const descriptor = sectionLabelDescriptor(raw)
  return descriptor
    ? i18n._(descriptor.id, undefined, {
        message: descriptor.message ?? descriptor.id
      })
    : raw
}

/**
 * Turn detected sections into marker points: a marker at each section's start,
 * its raw engine label translated to display copy — a plain committed string,
 * a marker stores no descriptor.
 */
export function sectionMarkers(
  sections: readonly DetectedSection[]
): readonly SectionMarker[] {
  return sections.map((section) => ({
    timeSeconds: section.startSeconds,
    label: sectionDisplayLabel(section.label)
  }))
}

/**
 * The inverse mapping: read the timeline's structure markers back as the
 * song's sections (cues skipped) — what a chord detection hands `detectChords`
 * so its draft is cut by the structure already on the timeline instead of
 * erasing it. Marker labels are ALREADY display copy, carried verbatim (the
 * draft prints them verbatim too); each section runs to the next structure
 * marker's start, the last one open-ended. A label a `[header]` line cannot
 * carry (blank, or holding a newline — reachable through a restored project,
 * the rename input forbids both) is skipped: it would corrupt the draft.
 */
export function markerSections(
  markers: MarkerList
): readonly DetectedSection[] {
  const structure = markers
    .filter(
      (marker) =>
        marker.kind === 'structure' &&
        marker.label.trim() !== '' &&
        !marker.label.includes('\n')
    )
    .toSorted((a, b) => a.timeSeconds - b.timeSeconds)
  return structure.map((marker, index) => ({
    startSeconds: marker.timeSeconds,
    endSeconds: structure[index + 1]?.timeSeconds ?? Number.POSITIVE_INFINITY,
    label: marker.label
  }))
}
