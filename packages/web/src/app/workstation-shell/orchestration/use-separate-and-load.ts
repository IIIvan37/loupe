import {
  type DecodedAudio,
  type MixerState,
  type SeparatedStem,
  UNITY_GAIN_DB
} from '@app/core'
import { useAtomValue } from 'jotai'
import { METRONOME_ID } from '../../mixer/synthetic-stem.ts'
import type { Mixer } from '../../mixer/use-mixer.ts'
import { useSeparation } from '../../separation/use-separation.ts'
import { DEFAULT_METRONOME_CHANNEL } from '../../tempo/metronome-stem.ts'
import { tempoAnalysisAtom } from '../../tempo/tempo-atoms.ts'
import { useMetronome } from '../../tempo/use-metronome.ts'

interface SeparateAndLoadDeps {
  /** The mix the stems (and click) land in — the shell stack's instance (the
   * engine seam, same idiom as `MetronomeDeps`); separation and metronome are
   * the features' own, derived here, not passed. */
  readonly mixer: Mixer
}

/**
 * Runs a separation and wires the resulting stems into the mixer in one pass —
 * carrying the always-on metronome alongside them when a tempo is known, so
 * neither load overwrites the other. Kept out of the shell so the event handler
 * reads as one call; the audio-engine sync belongs to this moment, not an effect.
 */
export function useSeparateAndLoad({
  mixer
}: SeparateAndLoadDeps): (
  audio: DecodedAudio | undefined
) => Promise<readonly SeparatedStem[] | undefined> {
  // The separation bag is feature-owned now (ADR 0010): the hook reads the
  // same session separation as the shell stack's instance, atoms included.
  const separation = useSeparation()
  // The metronome derives too (ADR 0010): whether a click is seated is session
  // state (`metronomeEnabledAtom`), so this instance and the shell's agree.
  const metronome = useMetronome({ mixer })
  // The tempo grid is feature-owned now (ADR 0010): read it off the atom rather
  // than threading the whole tempo bag through the shell to reach it.
  const analysis = useAtomValue(tempoAnalysisAtom)
  // Resolves with the isolated sources once the mixer is wired — the chord
  // flow's implicit separation (4a) awaits them; undefined on failure/cancel
  // (the caller falls back, separation's own UI already told the story).
  return async (audio) => {
    if (!audio) {
      return undefined
    }
    return separation.separate(audio).then((result) => {
      if (!result) {
        return undefined
      }
      if (analysis) {
        // Fresh stems start at unity; carry the metronome's current settings
        // (muted by default, or whatever the user set). Only PRESENT stems get a
        // channel — same as `mixer.load`, so masked ones never become phantom
        // channels the save persists.
        const baseMixer: MixerState = result.stems.flatMap((stem) =>
          stem.present
            ? [
                {
                  id: stem.id,
                  gainDb: UNITY_GAIN_DB,
                  muted: false,
                  soloed: false
                }
              ]
            : []
        )
        const metronomeChannel =
          mixer.state.find((channel) => channel.id === METRONOME_ID) ??
          DEFAULT_METRONOME_CHANNEL
        metronome.attach(
          analysis.grid,
          result.stems,
          result.sources,
          audio,
          baseMixer,
          metronomeChannel
        )
      } else {
        mixer.load(result.stems, result.sources)
      }
      return result.sources
    })
  }
}
