import type { BeatGrid } from './tempo.ts'

/**
 * One functional section of a song: a label (the engine's raw vocabulary —
 * `verse`, `chorus`, `intro`… — translating it to display copy is the
 * adapter's job) held over `[startSeconds, endSeconds)`. The structure
 * detector reports these in order, contiguous, in raw seconds; the core snaps
 * their boundaries to the beat grid (the detector has no beats — beat_this is
 * the tempo authority).
 */
export interface DetectedSection {
  readonly startSeconds: number
  readonly endSeconds: number
  readonly label: string
}

/**
 * Snap section boundaries to the nearest downbeat so sections start on measures
 * (a section is a whole number of bars, aligned with the chord grid).
 *
 * Measured against beat_this on real tracks: detector boundaries already land
 * essentially on downbeats (median jitter 0.14 s), so this is a cleanup, not a
 * rescue. Four rules, from the three beatless-zone outliers that measurement
 * exposed:
 *
 * 1. an interior boundary snaps to the nearest downbeat only when it is within
 *    one bar of it; a boundary in a beatless zone (a pickup, an outro fade
 *    where beat tracking drops out) is more than a bar from any downbeat and
 *    keeps its raw time;
 * 2. the first boundary is never snapped forward — a pickup before the first
 *    downbeat must not drag the opening section off the track start (0);
 * 3. the last boundary is never snapped back — the final section runs to the
 *    track end, not back to the last detected downbeat;
 * 4. two boundaries that snap to the same downbeat collapse a sub-bar section
 *    away, and its neighbours meet on that downbeat.
 *
 * With no downbeats (or fewer than two, so no bar length) there is nothing to
 * snap to and the sections pass through unchanged.
 */
export function snapSectionsToGrid(
  sections: readonly DetectedSection[],
  grid: BeatGrid
): readonly DetectedSection[] {
  if (sections.length === 0) {
    return sections
  }
  const downbeats = grid
    .filter((beat) => beat.downbeat)
    .map((beat) => beat.timeSeconds)
  const bar = typicalBar(downbeats)
  if (bar === undefined) {
    return sections
  }
  // The section boundaries: the first start, then every end (contiguous, so
  // each end is the next start). Snap the interior ones; keep the endpoints.
  const boundaries = [
    (sections[0] as DetectedSection).startSeconds,
    ...sections.map((s) => s.endSeconds)
  ]
  const snapped = boundaries.map((time, index) => {
    if (index === 0 || index === boundaries.length - 1) {
      return time
    }
    const nearest = nearestDownbeat(downbeats, time)
    return Math.abs(nearest - time) <= bar ? nearest : time
  })
  // Rebuild, dropping any section a collapse made non-positive in length.
  const result: DetectedSection[] = []
  for (let i = 0; i < sections.length; i++) {
    const start = snapped[i] as number
    const end = snapped[i + 1] as number
    if (end > start) {
      result.push({
        startSeconds: start,
        endSeconds: end,
        label: (sections[i] as DetectedSection).label
      })
    }
  }
  return result
}

/** The median gap between consecutive downbeats — a robust bar length, or
 *  undefined when there are fewer than two downbeats (no interval). */
function typicalBar(downbeats: readonly number[]): number | undefined {
  if (downbeats.length < 2) {
    return undefined
  }
  const gaps = downbeats
    .slice(1)
    .map((time, index) => time - (downbeats[index] as number))
    .sort((a, b) => a - b)
  const mid = Math.floor(gaps.length / 2)
  return gaps.length % 2 === 0
    ? ((gaps[mid - 1] as number) + (gaps[mid] as number)) / 2
    : (gaps[mid] as number)
}

/** The downbeat closest to `time` (downbeats are in ascending order). */
function nearestDownbeat(downbeats: readonly number[], time: number): number {
  let best = downbeats[0] as number
  for (const downbeat of downbeats) {
    if (Math.abs(downbeat - time) < Math.abs(best - time)) {
      best = downbeat
    }
  }
  return best
}
