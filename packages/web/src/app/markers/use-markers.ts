import {
  addMarker,
  emptyMarkerList,
  type Marker,
  type MarkerList,
  moveMarker,
  removeMarker
} from '@app/core'
import { msg } from '@lingui/core/macro'
import { useState } from 'react'
import { i18n } from '../../i18n/i18n.ts'
import type { SectionMarker } from './section-markers.ts'

// The auto label minted for a fresh marker: « Repère 1 », « Repère 2 », …
const defaultMarkerName = msg({
  id: 'markers.default-name',
  message: 'Repère {number}'
})

export interface Markers {
  readonly markers: MarkerList
  /** Drop a named marker at the given time (the playhead). */
  readonly addAt: (timeSeconds: number) => void
  /** Rename an existing marker (same id and time kept). */
  readonly rename: (id: string, label: string) => void
  /** Move an existing marker to a new time (same id and label kept). */
  readonly move: (id: string, timeSeconds: number) => void
  readonly remove: (id: string) => void
  /**
   * Replace the whole list with section markers (structure detection): each
   * point becomes a fresh, identity-minted marker. Detection owns the timeline,
   * so this supersedes the current markers — the button confirms first when any
   * exist.
   */
  readonly setSections: (sections: readonly SectionMarker[]) => void
  /** Drop every marker — e.g. when a new track is loaded. */
  readonly clear: () => void
  /** Replace the whole list with a persisted one (opening a project). */
  readonly restore: (markers: MarkerList) => void
}

/**
 * Smart hook holding the (in-memory) marker list. Identity and the auto label are
 * minted here — the impure bits the pure `MarkerList` domain refuses to own.
 */
export function useMarkers(): Markers {
  const [markers, setMarkers] = useState<MarkerList>(emptyMarkerList)

  function addAt(timeSeconds: number): void {
    setMarkers((current) => {
      const marker: Marker = {
        id: crypto.randomUUID(),
        timeSeconds,
        // Resolved at runtime; msg() above is what extraction sees.
        label: i18n._(
          defaultMarkerName.id,
          { number: current.length + 1 },
          { message: defaultMarkerName.message ?? defaultMarkerName.id }
        )
      }
      return addMarker(current, marker)
    })
  }

  function rename(id: string, label: string): void {
    setMarkers((current) => {
      const target = current.find((m) => m.id === id)
      // addMarker replaces by id, so renaming keeps order and identity.
      return target ? addMarker(current, { ...target, label }) : current
    })
  }

  function move(id: string, timeSeconds: number): void {
    setMarkers((current) => moveMarker(current, id, timeSeconds))
  }

  function remove(id: string): void {
    setMarkers((current) => removeMarker(current, id))
  }

  function setSections(sections: readonly SectionMarker[]): void {
    setMarkers(
      sections.reduce<MarkerList>(
        (list, section) =>
          addMarker(list, {
            id: crypto.randomUUID(),
            timeSeconds: section.timeSeconds,
            label: section.label
          }),
        emptyMarkerList
      )
    )
  }

  function clear(): void {
    setMarkers(emptyMarkerList)
  }

  function restore(next: MarkerList): void {
    setMarkers(next)
  }

  return { markers, addAt, rename, move, remove, setSections, clear, restore }
}
