import type { DetectedSection } from '@app/core'
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
