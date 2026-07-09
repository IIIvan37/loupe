import type { Beat, BeatGrid } from './tempo.ts'

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

/**
 * One bar of clicks played before the playhead starts moving: the beats to
 * click (relative to the count-in start) and how long to hold the transport —
 * playback begins exactly where the next downbeat would fall.
 */
export interface CountIn {
  readonly beats: BeatGrid
  readonly durationSeconds: number
}

/**
 * Lay out a one-bar count-in at the tempo the player will HEAR: beats every
 * `60 / (bpm × playbackRate)` seconds (a half-speed practice run counts in at
 * half speed), the first accented as the bar's « one ». No playable tempo or
 * rate means no count-in at all; a degenerate meter counts a one-beat bar.
 */
export function buildCountIn(
  bpm: number,
  beatsPerBar: number,
  playbackRate = 1
): CountIn | undefined {
  if (
    !Number.isFinite(bpm) ||
    bpm <= 0 ||
    !Number.isFinite(playbackRate) ||
    playbackRate <= 0
  ) {
    return undefined
  }
  const bar = Math.max(1, Math.floor(beatsPerBar) || 1)
  const interval = 60 / (bpm * playbackRate)
  const beats: Beat[] = []
  for (let k = 0; k < bar; k++) {
    beats.push({ timeSeconds: k * interval, downbeat: k === 0 })
  }
  return { beats, durationSeconds: bar * interval }
}
