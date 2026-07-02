import {
  addMarker,
  emptyMarkerList,
  type Marker,
  type MarkerList,
  removeMarker
} from '@app/core'
import { useState } from 'react'

export interface Markers {
  readonly markers: MarkerList
  /** Drop a named marker at the given time (the playhead). */
  readonly addAt: (timeSeconds: number) => void
  /** Rename an existing marker (same id and time kept). */
  readonly rename: (id: string, label: string) => void
  readonly remove: (id: string) => void
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
        label: `Repère ${current.length + 1}`
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

  function remove(id: string): void {
    setMarkers((current) => removeMarker(current, id))
  }

  function clear(): void {
    setMarkers(emptyMarkerList)
  }

  function restore(next: MarkerList): void {
    setMarkers(next)
  }

  return { markers, addAt, rename, remove, clear, restore }
}
