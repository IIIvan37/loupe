import { MIN_ZOOM } from '@app/core'
import { atom } from 'jotai'

/**
 * The viewport's view state, owned by this feature (ADR 0010) — declared here,
 * not in the shell, so every consumer (the stage's controls, the shortcuts,
 * the project restore) drives the same session zoom without a prop threaded.
 * Every transition stays in `useViewport`, which calls the domain's clamp and
 * steps — the ADR's anti-erosion guard.
 */

/** Current magnification, 1× … 6× — fully zoomed out until someone steps in. */
export const viewportZoomAtom = atom(MIN_ZOOM)
