import type { Marker } from './marker.ts'

/** An immutable, time-ordered collection of markers. */
export type MarkerList = ReadonlyArray<Marker>

export const emptyMarkerList: MarkerList = []

/**
 * Insert a marker, keeping the list sorted by time. Re-adding the same `id`
 * replaces it (so a moved marker stays unique). Pure — a new list out.
 */
export function addMarker(list: MarkerList, marker: Marker): MarkerList {
  const without = list.filter((existing) => existing.id !== marker.id)
  // Insert before the first later marker; equal times keep insertion order.
  const index = without.findIndex(
    (existing) => existing.timeSeconds > marker.timeSeconds
  )
  if (index === -1) {
    return [...without, marker]
  }
  return [...without.slice(0, index), marker, ...without.slice(index)]
}

/** Drop the marker with `id`; a missing id leaves the list unchanged. */
export function removeMarker(list: MarkerList, id: string): MarkerList {
  return list.filter((marker) => marker.id !== id)
}
