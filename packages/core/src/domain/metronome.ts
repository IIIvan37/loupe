import type { BeatGrid } from './tempo.ts'

/** How to render a click track from a beat grid. */
export interface ClickTrackOptions {
  readonly beats: BeatGrid
  /** Total length of the track in seconds (sizes the buffer). */
  readonly durationSeconds: number
  readonly sampleRate: number
}

/** Length of one click in seconds — a short percussive blip. */
const CLICK_SECONDS = 0.03
/** Exponential decay rate of a click's envelope (per second). */
const DECAY_PER_SECOND = 40
/** Tone of an accented bar start vs a plain beat, in hertz. */
const DOWNBEAT_HZ = 2000
const BEAT_HZ = 1000
/** Peak amplitude of an accented bar start vs a plain beat. */
const DOWNBEAT_GAIN = 1
const BEAT_GAIN = 0.6

/**
 * Render a mono click track from a beat grid: a short exponentially-decaying
 * sine blip at each beat, accented (louder and higher) on downbeats. Pure —
 * samples in, samples out; the caller owns the sample rate and wraps the result
 * (e.g. `encodeWav`). Beats past the track end are ignored, and overlapping
 * clicks sum then clamp to [-1, 1] so a dense grid never wraps around.
 */
export function synthesizeClickTrack(options: ClickTrackOptions): Float32Array {
  const { beats, durationSeconds, sampleRate } = options
  const length = Math.round(durationSeconds * sampleRate)
  const samples = new Float32Array(length)
  const clickFrames = Math.round(CLICK_SECONDS * sampleRate)

  for (const beat of beats) {
    const start = Math.round(beat.timeSeconds * sampleRate)
    if (start < 0 || start >= length) {
      continue
    }
    const frequency = beat.downbeat ? DOWNBEAT_HZ : BEAT_HZ
    const gain = beat.downbeat ? DOWNBEAT_GAIN : BEAT_GAIN
    for (let i = 0; i < clickFrames && start + i < length; i++) {
      const t = i / sampleRate
      const envelope = Math.exp(-DECAY_PER_SECOND * t)
      const value = gain * envelope * Math.sin(2 * Math.PI * frequency * t)
      const summed = (samples[start + i] ?? 0) + value
      samples[start + i] = Math.max(-1, Math.min(1, summed))
    }
  }

  return samples
}
