import type { Beat, BeatGrid } from './beat-grid.ts'
import { buildTempoMap, tempoAt } from './tempo-map.ts'

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

/** What a count-in is laid out from: the track's grid and the player's state. */
export interface CountInInput {
  /** The track's beat grid — the landing snaps to it and phases the accents. */
  readonly grid: BeatGrid
  /** Headline tempo, the fallback when the grid can't answer (too few beats). */
  readonly bpm: number
  readonly beatsPerBar: number
  /** Where the player pressed play — snapped to the nearest grid beat. */
  readonly playheadSeconds: number
  /** Tempo as a ratio of normal speed — the count matches the HEARD tempo. */
  readonly playbackRate: number
}

/**
 * One bar of clicks played before the playhead starts moving: where playback
 * will actually start, the counts leading into it, and how long to hold the
 * transport — playback begins exactly one interval after the last count, and
 * the landing click is the TRACK's own (the count-in must not double it).
 */
export interface CountIn {
  /** The landing: the grid beat nearest the playhead — seek here, start here. */
  readonly startSeconds: number
  /** The counts (relative to the count-in start); the landing is not one. */
  readonly beats: BeatGrid
  /** When to start the transport: one interval after the last count. */
  readonly durationSeconds: number
}

/**
 * Lay out a one-bar count-in leading into the track's own grid. The landing is
 * the grid beat NEAREST the playhead (a playhead parked mid-interval must not
 * start an off-grid count), the counts run backwards from it at the tempo the
 * player will HEAR (`60 / (bpm × playbackRate)` — a half-speed practice run
 * counts in at half speed, felt at the landing via the tempo map), and the
 * accents follow the TRACK's bar phase: landing on beat 2 sounds « 2 3 4 1 »
 * then starts on the 2, the accent where the track's own « one » is — never a
 * false one. The landing click itself is deliberately NOT part of the count-in:
 * the snapped start puts a track click exactly there, and sounding both would
 * flam. No playable tempo or rate means no count-in at all; a degenerate meter
 * counts a one-beat bar; an empty grid counts from the playhead itself.
 */
export function buildCountIn(input: CountInInput): CountIn | undefined {
  const { grid, beatsPerBar, playheadSeconds, playbackRate } = input
  if (!Number.isFinite(playbackRate) || playbackRate <= 0) {
    return undefined
  }
  const landingIndex = nearestBeatIndex(grid, playheadSeconds)
  const landing = landingIndex === undefined ? undefined : grid[landingIndex]
  const startSeconds = landing?.timeSeconds ?? playheadSeconds
  // The tempo felt at the landing (the map answers from two beats up), else
  // the headline bpm.
  const bpm = tempoAt(buildTempoMap(grid), startSeconds) ?? input.bpm
  if (!Number.isFinite(bpm) || bpm <= 0) {
    return undefined
  }
  const bar = Math.max(1, Math.floor(beatsPerBar) || 1)
  const interval = 60 / (bpm * playbackRate)
  const landingOffset =
    landingIndex === undefined ? 0 : barOffsetAt(grid, landingIndex, bar)
  const beats: Beat[] = []
  for (let k = 0; k < bar; k++) {
    // Count k sits (bar - k) beats before the landing — accent the count
    // that falls where the track's own « one »s do.
    beats.push({
      timeSeconds: k * interval,
      downbeat: (landingOffset + k) % bar === 0
    })
  }
  return { startSeconds, beats, durationSeconds: bar * interval }
}

/** Index of the grid beat nearest the instant (earlier wins a tie). */
function nearestBeatIndex(grid: BeatGrid, seconds: number): number | undefined {
  let best: number | undefined
  grid.forEach((beat, index) => {
    const current = grid[best ?? 0]
    if (
      best === undefined ||
      (current !== undefined &&
        Math.abs(beat.timeSeconds - seconds) <
          Math.abs(current.timeSeconds - seconds))
    ) {
      best = index
    }
  })
  return best
}

/**
 * How many beats past its bar's « one » a grid beat sits (0 = a downbeat).
 * Counted from the nearest flagged downbeat — behind by preference, ahead for
 * a beat before the first downbeat (a pickup); 0 when the grid flags none.
 */
function barOffsetAt(grid: BeatGrid, index: number, bar: number): number {
  for (let i = index; i >= 0; i--) {
    if (grid[i]?.downbeat) {
      return (index - i) % bar
    }
  }
  for (let i = index + 1; i < grid.length; i++) {
    if (grid[i]?.downbeat) {
      return (((index - i) % bar) + bar) % bar
    }
  }
  return 0
}
