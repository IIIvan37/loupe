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

/**
 * The marker→chart half of the structure sync, as a per-store box: the
 * orchestration seats `onStructureEdited` (it owns the chart and the grid —
 * this feature must not reach into another feature's atoms), and `useMarkers`
 * fires it after every USER edit that touches a structure marker. Inbound
 * syncs (`setSections`, a restore) stay silent — they'd bounce. Read-only
 * atom whose init runs once per store, mutated in place (never rendered),
 * exactly like the separation's run box.
 */
export const structureEditSyncAtom = atom(() => ({
  onStructureEdited: undefined as ((markers: MarkerList) => void) | undefined
}))
