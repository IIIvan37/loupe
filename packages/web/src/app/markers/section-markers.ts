import type { DetectedSection } from '@app/core'
import { i18n } from '../../i18n/i18n.ts'
import { sectionLabelDescriptor } from './section-label.ts'

/** A section marker point: a translated label at the section's start. */
export interface SectionMarker {
  readonly timeSeconds: number
  readonly label: string
}

/**
 * Turn detected sections into marker points: a marker at each section's start,
 * its raw engine label (`verse`…) translated to display copy. An unknown label
 * passes through verbatim so a new engine tag still lands a usable marker.
 * Resolved through the shared i18n singleton (like the auto marker name), so
 * the label is a plain committed string — a marker stores no descriptor.
 */
export function sectionMarkers(
  sections: readonly DetectedSection[]
): readonly SectionMarker[] {
  return sections.map((section) => {
    const descriptor = sectionLabelDescriptor(section.label)
    return {
      timeSeconds: section.startSeconds,
      label: descriptor
        ? i18n._(descriptor.id, undefined, {
            message: descriptor.message ?? descriptor.id
          })
        : section.label
    }
  })
}
