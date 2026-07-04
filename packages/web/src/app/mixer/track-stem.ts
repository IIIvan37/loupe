import {
  buildStemTrack,
  type DecodedAudio,
  type SeparatedStem,
  type StemTrack
} from '@app/core'

/** The stem id/label the whole track occupies when it joins the mix un-split. */
export const TRACK_STEM_ID = 'piste'
const TRACK_STEM_LABEL = 'Piste'

/** Peak resolution of the track lane — matches the separation stems'. */
const BUCKET_COUNT = 1200

/** One mixer-ready stem: its render track plus the raw PCM the engine plays. */
interface TrackStem {
  readonly stem: StemTrack
  readonly source: SeparatedStem
}

/**
 * Wrap the whole imported track as a single mixer stem, so an un-separated track
 * can share the multitrack engine with the metronome (the click needs something
 * to play against). Reuses the exact stem summary a separation produces.
 */
export function buildTrackStem(audio: DecodedAudio): TrackStem {
  const stem = buildStemTrack(
    TRACK_STEM_ID,
    TRACK_STEM_LABEL,
    audio.channels,
    audio.sampleRate,
    BUCKET_COUNT,
    { confidence: 1, present: true }
  )
  return {
    stem,
    source: { id: TRACK_STEM_ID, label: TRACK_STEM_LABEL, audio }
  }
}
