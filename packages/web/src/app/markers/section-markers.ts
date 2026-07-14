import type { DetectedSection, Marker, MarkerList } from '@app/core'
import { i18n } from '../../i18n/i18n.ts'
import { SECTION_LABEL_TAGS, sectionLabelDescriptor } from './section-label.ts'

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
 * Adopt the structure kind on a restored marker list: a project saved before
 * marker kinds existed persisted its detected structure markers as PLAIN
 * markers, and restored verbatim they read as cues — the next detection then
 * keeps them and ADDS a fresh set beside them (the duplicated-labels bug).
 * A kind-less marker whose label belongs to the section vocabulary — either
 * spelling: the raw engine tag or its display copy — is a detection's marker,
 * so it re-becomes `kind: 'structure'` (and thus replaceable). A hand-named
 * cue that collides with the vocabulary becomes overwritable too — the mild
 * cost of an unversioned manifest. Saves made since kinds exist round-trip
 * their `kind` and pass through untouched.
 */
export function adoptStructureKinds(markers: MarkerList): MarkerList {
  const vocabulary = new Set(
    SECTION_LABEL_TAGS.flatMap((raw) => [raw, sectionDisplayLabel(raw)])
  )
  return markers.map(
    (marker): Marker =>
      marker.kind === undefined && vocabulary.has(marker.label)
        ? { ...marker, kind: 'structure' }
        : marker
  )
}
