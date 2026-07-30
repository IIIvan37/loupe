import { TRACK_STEM_ID } from './track-stem.ts'

/** The stem id/label the metronome click occupies in the mixer. The id lives
 * here — the mixer owns the identity of its synthetic lanes (ADR 0012); the
 * tempo feature builds the click stem around it. */
export const METRONOME_ID = 'metronome'

/**
 * The synthetic stems that ride the mixer without belonging to a saved
 * separation: the always-on metronome click and the whole-track « Piste » lane
 * an un-separated track occupies. The audio behind both is re-synthesised on
 * open, never stored — so a save must exclude them from its separation mixer.
 * The single source of truth for "which mixer channels are not real stems".
 */
export function isSyntheticStem(id: string): boolean {
  return id === METRONOME_ID || id === TRACK_STEM_ID
}
