import {
  addMarker,
  emptyMarkerList,
  type Marker,
  type MarkerKind,
  type MarkerList,
  removeMarker
} from '@app/core'
import { useState } from 'react'

const KIND_LABEL: Record<MarkerKind, string> = {
  section: 'Section',
  measure: 'Mesure',
  beat: 'Temps'
}

export interface Markers {
  readonly markers: MarkerList
  /** Add a marker of `kind` at the given time (the playhead). */
  readonly addAt: (kind: MarkerKind, timeSeconds: number) => void
  readonly remove: (id: string) => void
  /** Drop every marker — e.g. when a new track is loaded. */
  readonly clear: () => void
}

/**
 * Smart hook holding the (in-memory) marker list. Identity and the auto label are
 * minted here — the impure bits the pure `MarkerList` domain refuses to own.
 */
export function useMarkers(): Markers {
  const [markers, setMarkers] = useState<MarkerList>(emptyMarkerList)

  function addAt(kind: MarkerKind, timeSeconds: number): void {
    setMarkers((current) => {
      const ordinal = current.filter((m) => m.kind === kind).length + 1
      const marker: Marker = {
        id: crypto.randomUUID(),
        timeSeconds,
        kind,
        label: `${KIND_LABEL[kind]} ${ordinal}`
      }
      return addMarker(current, marker)
    })
  }

  function remove(id: string): void {
    setMarkers((current) => removeMarker(current, id))
  }

  function clear(): void {
    setMarkers(emptyMarkerList)
  }

  return { markers, addAt, remove, clear }
}
