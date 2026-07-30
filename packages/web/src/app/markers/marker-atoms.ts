import { emptyMarkerList, type MarkerList } from '@app/core'
import { atom } from 'jotai'

/**
 * The markers' view state, owned by this feature (ADR 0010) — declared here,
 * not in the shell, so every consumer (regions, orchestrators) reads the same
 * list without a prop being threaded. Nothing decides anything in this file:
 * every transition stays in `useMarkers`, which calls the core's `MarkerList`
 * operations — the ADR's anti-erosion guard.
 */

/** The session's marker list (cues + structure sections), empty until laid. */
export const markersAtom = atom<MarkerList>(emptyMarkerList)
