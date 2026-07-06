import { METRONOME_ID } from '../tempo/metronome-stem.ts'
import { TRACK_STEM_ID } from './track-stem.ts'

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
