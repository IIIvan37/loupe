import { atom } from 'jotai'

/**
 * The chord chart's view state, owned by this feature (ADR 0010) — the source
 * text as the user's edit plus the transposition offset, one value because
 * `transposeChart` rewrites text AND offset in a single pure move. Session
 * state, not an instance's: the panel edits it, the project session saves and
 * restores it, the structure flow relabels it — every derived `useChordChart`
 * must see the same chart. Every transition stays in `useChordChart`, which
 * calls the core's pure moves — the ADR's anti-erosion guard.
 */
export const chordChartAtom = atom({ source: '', transposedBy: 0 })
