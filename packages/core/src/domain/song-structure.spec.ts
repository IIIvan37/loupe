import { describe, expect, it } from 'vitest'
import { type DetectedSection, snapSectionsToGrid } from './song-structure.ts'
import type { BeatGrid } from './tempo.ts'

/** A 4/4 grid at a steady bar length: `bars` downbeats `barSeconds` apart, each
 *  followed by three off-beats, starting at `from`. */
function grid(bars: number, barSeconds: number, from = 0): BeatGrid {
  const beats = []
  for (let bar = 0; bar < bars; bar++) {
    const barStart = from + bar * barSeconds
    for (let beat = 0; beat < 4; beat++) {
      beats.push({
        timeSeconds: barStart + (beat * barSeconds) / 4,
        downbeat: beat === 0
      })
    }
  }
  return beats
}

/** The boundary timeline of a section list: the first start, then every end. */
function boundaries(sections: readonly DetectedSection[]): number[] {
  if (sections.length === 0) {
    return []
  }
  return [
    (sections[0] as DetectedSection).startSeconds,
    ...sections.map((s) => s.endSeconds)
  ]
}

describe('snapSectionsToGrid', () => {
  it('snaps an interior boundary that lands just off a downbeat onto it', () => {
    // A boundary at 8.05s, a downbeat at 8.0s (bar 2s) — jitter under a bar.
    const sections: DetectedSection[] = [
      { startSeconds: 0, endSeconds: 8.05, label: 'intro' },
      { startSeconds: 8.05, endSeconds: 16, label: 'verse' }
    ]
    expect(boundaries(snapSectionsToGrid(sections, grid(9, 2)))).toEqual([
      0, 8, 16
    ])
  })

  it('keeps an interior boundary that is more than a bar from any downbeat', () => {
    // The outro region has no downbeat near 14.9s (last downbeat at 8s, then
    // the grid stops) — the boundary stays raw rather than snapping back.
    const sections: DetectedSection[] = [
      { startSeconds: 0, endSeconds: 8, label: 'verse' },
      { startSeconds: 8, endSeconds: 14.9, label: 'chorus' },
      { startSeconds: 14.9, endSeconds: 20, label: 'outro' }
    ]
    expect(boundaries(snapSectionsToGrid(sections, grid(5, 2)))).toEqual([
      0, 8, 14.9, 20
    ])
  })

  it('never snaps the first boundary forward off the track start', () => {
    // The pickup before the first downbeat (at 6s) must not drag section 1's
    // start from 0 up to 6.
    const sections: DetectedSection[] = [
      { startSeconds: 0, endSeconds: 12, label: 'intro' },
      { startSeconds: 12, endSeconds: 24, label: 'verse' }
    ]
    const out = snapSectionsToGrid(sections, grid(6, 6, 6)) // downbeats 6,12,…
    expect(out.map((s) => s.startSeconds)[0]).toBe(0)
  })

  it('never snaps the last boundary back off the track end', () => {
    // Beat tracking drops out before the end; the final section still runs to
    // the track end, not back to the last downbeat.
    const sections: DetectedSection[] = [
      { startSeconds: 0, endSeconds: 8, label: 'verse' },
      { startSeconds: 8, endSeconds: 25, label: 'outro' }
    ]
    const out = snapSectionsToGrid(sections, grid(5, 2)) // last downbeat 8
    expect(out.map((s) => s.endSeconds).at(-1)).toBe(25)
  })

  it('merges two sections whose boundaries collapse onto the same downbeat', () => {
    // A sub-bar section (8.0–8.3) between two downbeat-aligned neighbours: both
    // its boundaries snap to 8, so it vanishes and the neighbours meet.
    const sections: DetectedSection[] = [
      { startSeconds: 0, endSeconds: 8.0, label: 'verse' },
      { startSeconds: 8.0, endSeconds: 8.3, label: 'fill' },
      { startSeconds: 8.3, endSeconds: 16, label: 'chorus' }
    ]
    const out = snapSectionsToGrid(sections, grid(9, 2))
    expect(out.map((s) => s.label)).toEqual(['verse', 'chorus'])
    expect(boundaries(out)).toEqual([0, 8, 16])
  })

  it('leaves boundaries contiguous after snapping', () => {
    const sections: DetectedSection[] = [
      { startSeconds: 0, endSeconds: 8.1, label: 'a' },
      { startSeconds: 8.1, endSeconds: 15.9, label: 'b' },
      { startSeconds: 15.9, endSeconds: 24, label: 'c' }
    ]
    const out = snapSectionsToGrid(sections, grid(13, 2))
    const starts = out.map((s) => s.startSeconds)
    const ends = out.map((s) => s.endSeconds)
    expect(ends.slice(0, -1)).toEqual(starts.slice(1))
  })

  it('returns the sections unchanged when the grid has no downbeats', () => {
    const sections: DetectedSection[] = [
      { startSeconds: 0, endSeconds: 8.05, label: 'intro' }
    ]
    expect(snapSectionsToGrid(sections, [])).toEqual(sections)
  })

  it('breaks a downbeat tie toward the earlier downbeat', () => {
    // The middle boundary is equidistant from downbeats 0 and 10. Snapping it
    // to the EARLIER (0) collapses the first section and 'b' survives; snapping
    // to the later (10) would instead keep 'a'. So the tie direction is
    // observable in which label remains.
    const sections: DetectedSection[] = [
      { startSeconds: 0, endSeconds: 5, label: 'a' },
      { startSeconds: 5, endSeconds: 10, label: 'b' }
    ]
    const wide = [
      { timeSeconds: 0, downbeat: true },
      { timeSeconds: 10, downbeat: true }
    ]
    expect(snapSectionsToGrid(sections, wide).map((s) => s.label)).toEqual([
      'b'
    ])
  })

  it('cannot define a bar from a single downbeat — sections pass through', () => {
    // One downbeat = no interval = no bar length, so nothing snaps even though
    // the boundary sits right on that downbeat.
    const sections: DetectedSection[] = [
      { startSeconds: 0, endSeconds: 8.05, label: 'intro' },
      { startSeconds: 8.05, endSeconds: 16, label: 'verse' }
    ]
    const oneDownbeat = grid(1, 2) // a single downbeat at 0
    expect(snapSectionsToGrid(sections, oneDownbeat)).toEqual(sections)
  })

  it('keeps the endpoints even when they sit right on a downbeat', () => {
    // The first boundary is at 2.02 and the last at 13.98 — both within a bar
    // of a downbeat (2 and 14), but endpoints are never moved.
    const sections: DetectedSection[] = [
      { startSeconds: 2.02, endSeconds: 8, label: 'verse' },
      { startSeconds: 8, endSeconds: 13.98, label: 'outro' }
    ]
    const out = snapSectionsToGrid(sections, grid(9, 2)) // downbeats 0,2,…,16
    expect(out.map((s) => s.startSeconds)[0]).toBe(2.02)
    expect(out.map((s) => s.endSeconds).at(-1)).toBe(13.98)
  })

  it('snaps a boundary exactly one bar from the nearest downbeat', () => {
    // Δ == bar is inside the snap window (≤, not <): downbeats 0 and 4 (bar 4),
    // a boundary at 8 is exactly one bar from the downbeat at 4 → snaps to 4.
    const sections: DetectedSection[] = [
      { startSeconds: 0, endSeconds: 8, label: 'verse' },
      { startSeconds: 8, endSeconds: 12, label: 'chorus' }
    ]
    const twoBar = [
      { timeSeconds: 0, downbeat: true },
      { timeSeconds: 4, downbeat: true }
    ]
    expect(
      snapSectionsToGrid(sections, twoBar).map((s) => s.endSeconds)[0]
    ).toBe(4)
  })

  it('uses the median gap of an uneven grid, computed from sorted gaps', () => {
    // Downbeats 0,1,9,10 → gaps 1,8,1 → sorted median 1 (a mis-sorted median
    // would read 8). A boundary 3s from the nearest downbeat then stays raw
    // (3 > bar 1); with the wrong bar of 8 it would wrongly snap.
    const sections: DetectedSection[] = [
      { startSeconds: 0, endSeconds: 6, label: 'a' },
      { startSeconds: 6, endSeconds: 12, label: 'b' }
    ]
    const uneven = [
      { timeSeconds: 0, downbeat: true },
      { timeSeconds: 1, downbeat: true },
      { timeSeconds: 9, downbeat: true },
      { timeSeconds: 10, downbeat: true }
    ]
    // nearest downbeat to 6 is 9 (Δ3) > bar 1 → kept raw
    expect(
      snapSectionsToGrid(sections, uneven).map((s) => s.endSeconds)[0]
    ).toBe(6)
  })

  it('averages the two middle gaps of an even-length gap list', () => {
    // Downbeats 0,2,5,6,10 → gaps 2,3,1,4 → sorted 1,2,3,4 → median (2+3)/2 =
    // 2.5. A boundary 2.7s past the last downbeat stays raw (2.7 > 2.5); the
    // odd-index median (3) would have snapped it.
    const sections: DetectedSection[] = [
      { startSeconds: 0, endSeconds: 12.7, label: 'a' },
      { startSeconds: 12.7, endSeconds: 20, label: 'b' }
    ]
    const evenGaps = [
      { timeSeconds: 0, downbeat: true },
      { timeSeconds: 2, downbeat: true },
      { timeSeconds: 5, downbeat: true },
      { timeSeconds: 6, downbeat: true },
      { timeSeconds: 10, downbeat: true }
    ]
    // nearest downbeat to 12.7 is 10 (Δ2.7) > bar 2.5 → kept raw
    expect(
      snapSectionsToGrid(sections, evenGaps).map((s) => s.endSeconds)[0]
    ).toBe(12.7)
  })

  it('has nothing to snap for no sections', () => {
    expect(snapSectionsToGrid([], grid(4, 2))).toEqual([])
  })
})
