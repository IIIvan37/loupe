import {
  type BeatGrid,
  buildStemTrack,
  type DecodedAudio,
  type MixerChannel,
  type SeparatedStem,
  type StemTrack,
  synthesizeClickTrack,
  UNITY_GAIN_DB
} from '@app/core'

/** The stem id/label the metronome click occupies in the mixer. */
export const METRONOME_ID = 'metronome'
const METRONOME_LABEL = 'Métronome'

/**
 * A fresh metronome joins the mix muted — unlike every other voice, the click is
 * off by default; unmute the lane to hear it. Reopening a saved project restores
 * the settings the user actually left instead of this default.
 */
export const DEFAULT_METRONOME_CHANNEL: MixerChannel = {
  id: METRONOME_ID,
  gainDb: UNITY_GAIN_DB,
  muted: true,
  soloed: false
}

/** Peak resolution of the click lane — matches the separation stems'. */
const BUCKET_COUNT = 1200

/** One mixer-ready stem: its render track plus the raw PCM the engine plays. */
interface MetronomeStem {
  readonly stem: StemTrack
  readonly source: SeparatedStem
}

/**
 * Render the detected beat grid into a mixer-ready click stem: synthesize the
 * click PCM (aligned to the beats, accented downbeats) and summarise it into a
 * `StemTrack` the lane draws, exactly like a separated stem. The click spans the
 * track so it stays aligned under tempo changes on the shared master bus.
 */
export function buildMetronomeStem(
  grid: BeatGrid,
  durationSeconds: number,
  sampleRate: number
): MetronomeStem {
  const samples = synthesizeClickTrack({
    beats: grid,
    durationSeconds,
    sampleRate
  })
  const audio: DecodedAudio = { sampleRate, channels: [samples] }
  const stem = buildStemTrack(
    METRONOME_ID,
    METRONOME_LABEL,
    audio.channels,
    sampleRate,
    BUCKET_COUNT,
    { confidence: 1, present: true }
  )
  return { stem, source: { id: METRONOME_ID, label: METRONOME_LABEL, audio } }
}
