import {
  type DecodedAudio,
  type MixerState,
  type SeparatedStem,
  UNITY_GAIN_DB
} from '@app/core'
import type { useMixer } from '../mixer/use-mixer.ts'
import type { useSeparation } from '../separation/use-separation.ts'
import {
  DEFAULT_METRONOME_CHANNEL,
  METRONOME_ID
} from '../tempo/metronome-stem.ts'
import type { useMetronome } from '../tempo/use-metronome.ts'
import type { useTempo } from '../tempo/use-tempo.ts'

interface SeparateAndLoadDeps {
  readonly separation: ReturnType<typeof useSeparation>
  readonly tempo: ReturnType<typeof useTempo>
  readonly mixer: ReturnType<typeof useMixer>
  readonly metronome: ReturnType<typeof useMetronome>
}

/**
 * Runs a separation and wires the resulting stems into the mixer in one pass —
 * carrying the always-on metronome alongside them when a tempo is known, so
 * neither load overwrites the other. Kept out of the shell so the event handler
 * reads as one call; the audio-engine sync belongs to this moment, not an effect.
 */
export function useSeparateAndLoad({
  separation,
  tempo,
  mixer,
  metronome
}: SeparateAndLoadDeps): (
  audio: DecodedAudio | undefined
) => Promise<readonly SeparatedStem[] | undefined> {
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
      if (tempo.analysis) {
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
          tempo.analysis.grid,
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
