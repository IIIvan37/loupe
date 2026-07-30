import { emptyLoopLibrary, type LoopLibrary } from '@app/core'
import { atom } from 'jotai'

/**
 * The loops' view state, owned by this feature (ADR 0010) — declared here, not
 * in the shell, so every consumer (the stage's drag surface, the loop chips,
 * the project session) sees the same session library without a prop being
 * threaded. Nothing decides anything in this file: every transition stays in
 * `useLoops`/`useLoopEditing`, which call the core's domain functions — the
 * ADR's anti-erosion guard.
 */

/** The saved-loop library — session state, scoped to the loaded track. */
export const loopLibraryAtom = atom<LoopLibrary>(emptyLoopLibrary)

/** The saved loop the active A/B region came from — null for a fresh,
 * unsaved selection (highlights the loop's chip, routes handle edits). */
export const activeLoopIdAtom = atom<string | null>(null)
