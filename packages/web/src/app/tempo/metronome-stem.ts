import {
  type BeatGrid,
  buildStemTrack,
  DEFAULT_METRONOME_SETTINGS,
  type DecodedAudio,
  type MixerChannel,
  type SeparatedStem,
  type StemTrack,
  synthesizeClickTrack
} from '@app/core'
import { METRONOME_ID } from '../mixer/synthetic-stem.ts'

const METRONOME_LABEL = 'Métronome'

/**
 * A fresh metronome joins the mix muted — unlike every other voice, the click is
 * off by default; unmute the lane to hear it. Reopening a saved project restores
 * the settings the user actually left instead of this default. The SETTINGS are
 * the core's (the session fingerprint signs the same values); only the lane id
 * is this adapter's (ADR 0012).
 */
export const DEFAULT_METRONOME_CHANNEL: MixerChannel = {
  id: METRONOME_ID,
  ...DEFAULT_METRONOME_SETTINGS
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
