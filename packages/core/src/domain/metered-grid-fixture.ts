import type { BeatGrid } from './tempo.ts'

/**
 * Test fixture: a grid whose i-th measure holds `meters[i]` beats, beats every
 * `beatSeconds` (0.5s). Shared by the tempo, chart-structure and detect-chords
 * specs so the "measure = downbeat interval" assumption lives in one place.
 */
export function meteredGrid(
  meters: readonly number[],
  beatSeconds = 0.5
): BeatGrid {
  const beats: { timeSeconds: number; downbeat: boolean }[] = []
  let time = 0
  for (const beatsInBar of meters) {
    for (let beat = 0; beat < beatsInBar; beat += 1) {
      beats.push({ timeSeconds: time, downbeat: beat === 0 })
      time += beatSeconds
    }
  }
  return beats
}
