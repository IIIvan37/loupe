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

/**
 * Move the marker with `id` to a new time, keeping its label and the list's
 * time order (re-inserted via `addMarker`). A missing id leaves the list
 * unchanged. Pure — a new list out.
 */
export function moveMarker(
  list: MarkerList,
  id: string,
  timeSeconds: number
): MarkerList {
  const target = list.find((marker) => marker.id === id)
  if (!target) {
    return list
  }
  return addMarker(list, { ...target, timeSeconds })
}

/** Drop the marker with `id`; a missing id leaves the list unchanged. */
export function removeMarker(list: MarkerList, id: string): MarkerList {
  return list.filter((marker) => marker.id !== id)
}

/**
 * Replace every structure marker with `structural` (the fresh chart-derived
 * set), keeping the cues untouched — the merge the chart-is-authority rule
 * needs on each edit. Time order is preserved via `addMarker`. Pure — a new
 * list out; ids on `structural` are minted by the adapter.
 */
export function replaceStructureMarkers(
  list: MarkerList,
  structural: MarkerList
): MarkerList {
  const cues = list.filter((marker) => marker.kind !== 'structure')
  return structural.reduce(addMarker, cues)
}
