import {
  addMarker,
  emptyMarkerList,
  type Marker,
  type MarkerList,
  moveMarker,
  removeMarker,
  replaceStructureMarkers
} from '@app/core'
import { msg } from '@lingui/core/macro'
import { useAtom, useAtomValue } from 'jotai'
import { i18n } from '../../i18n/i18n.ts'
import { markersAtom, structureEditSyncAtom } from './marker-atoms.ts'
import type { SectionMarker } from './section-markers.ts'

// The auto label minted for a fresh marker: « Repère 1 », « Repère 2 », …
const defaultMarkerName = msg({
  id: 'markers.default-name',
  message: 'Repère {number}'
})

// The auto label for a hand-laid section: « Section 1 », « Section 2 », …
const defaultSectionName = msg({
  id: 'markers.default-section-name',
  message: 'Section {number}'
})

export interface Markers {
  readonly markers: MarkerList
  /** Drop a named marker at the given time (the playhead). */
  readonly addAt: (timeSeconds: number) => void
  /**
   * Drop a STRUCTURE marker at the given time (the playhead) — the hand-laid
   * counterpart of a detection's sections. Overwritable like every structure
   * marker (the chart is the authority), and read back by the chord
   * detection, which cuts its draft at the timeline's sections.
   */
  readonly addSectionAt: (timeSeconds: number) => void
  /** Rename an existing marker (same id and time kept). */
  readonly rename: (id: string, label: string) => void
  /** Move an existing marker to a new time (same id and label kept). */
  readonly move: (id: string, timeSeconds: number) => void
  readonly remove: (id: string) => void
  /**
   * Replace the STRUCTURE markers with fresh section points (a detection run,
   * or the chart's headers after an edit — the chart text is the authority):
   * each point becomes a fresh, identity-minted `kind: 'structure'` marker.
   * Hand-dropped cues survive the replacement.
   */
  readonly setSections: (sections: readonly SectionMarker[]) => void
  /** Drop every marker — e.g. when a new track is loaded. */
  readonly clear: () => void
  /** Replace the whole list with a persisted one (opening a project). */
  readonly restore: (markers: MarkerList) => void
}

/**
 * Smart hook over the feature's marker list (`markersAtom`) — every consumer
 * sees the same session list. Identity and the auto label are minted here —
 * the impure bits the pure `MarkerList` domain refuses to own.
 */
export function useMarkers(): Markers {
  const [markers, setMarkers] = useAtom(markersAtom)
  const sync = useAtomValue(structureEditSyncAtom)

  /**
   * Run a transition and, when it touched a structure marker, hand the next
   * list to the seated marker→chart sync (the chart follows the timeline —
   * the mirror of `setSections`). Jotai applies the updater synchronously
   * exactly once, so capturing its result before notifying is sound.
   */
  function commit(
    transition: (current: MarkerList) => {
      readonly next: MarkerList
      readonly structural: boolean
    }
  ): void {
    let edited: MarkerList | undefined
    setMarkers((current) => {
      const { next, structural } = transition(current)
      edited = structural ? next : undefined
      return next
    })
    if (edited !== undefined) {
      sync.onStructureEdited?.(edited)
    }
  }

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

  function addSectionAt(timeSeconds: number): void {
    commit((current) => {
      const number =
        current.filter((marker) => marker.kind === 'structure').length + 1
      const marker: Marker = {
        id: crypto.randomUUID(),
        timeSeconds,
        label: i18n._(
          defaultSectionName.id,
          { number },
          { message: defaultSectionName.message ?? defaultSectionName.id }
        ),
        kind: 'structure'
      }
      return { next: addMarker(current, marker), structural: true }
    })
  }

  function rename(id: string, label: string): void {
    commit((current) => {
      const target = current.find((m) => m.id === id)
      // addMarker replaces by id, so renaming keeps order and identity.
      return target
        ? {
            next: addMarker(current, { ...target, label }),
            structural: target.kind === 'structure'
          }
        : { next: current, structural: false }
    })
  }

  function move(id: string, timeSeconds: number): void {
    commit((current) => ({
      next: moveMarker(current, id, timeSeconds),
      structural: current.find((m) => m.id === id)?.kind === 'structure'
    }))
  }

  function remove(id: string): void {
    commit((current) => ({
      next: removeMarker(current, id),
      structural: current.find((m) => m.id === id)?.kind === 'structure'
    }))
  }

  function setSections(sections: readonly SectionMarker[]): void {
    setMarkers((current) =>
      replaceStructureMarkers(
        current,
        sections.map((section) => ({
          id: crypto.randomUUID(),
          timeSeconds: section.timeSeconds,
          label: section.label,
          kind: 'structure'
        }))
      )
    )
  }

  function clear(): void {
    setMarkers(emptyMarkerList)
  }

  function restore(next: MarkerList): void {
    setMarkers(next)
  }

  return {
    markers,
    addAt,
    addSectionAt,
    rename,
    move,
    remove,
    setSections,
    clear,
    restore
  }
}
