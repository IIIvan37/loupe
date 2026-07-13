import type { BeatGrid } from '@app/core'
import { describe, expect, it, vi } from 'vitest'
import { syncStructureMarkersFromChart } from './chart-marker-sync.ts'

/** A 4/4 grid: `bars` downbeats 2 s apart, one off-beat between each. */
function grid(bars: number): BeatGrid {
  return Array.from({ length: bars * 2 }, (_, index) => ({
    timeSeconds: index,
    downbeat: index % 2 === 0
  }))
}

describe('syncStructureMarkersFromChart', () => {
  it('replaces the structure markers with the edited headers', () => {
    const setSections = vi.fn()
    syncStructureMarkersFromChart(
      '[Couplet]\n| C | Am |\n[Refrain]\n| F | G |',
      grid(4),
      { setSections }
    )
    expect(setSections).toHaveBeenCalledWith([
      { timeSeconds: 0, label: 'Couplet' },
      { timeSeconds: 4, label: 'Refrain' }
    ])
  })

  it('an edit that drops every header clears the structure markers', () => {
    const setSections = vi.fn()
    syncStructureMarkersFromChart('| C | Am |', grid(4), { setSections })
    expect(setSections).toHaveBeenCalledWith([])
  })

  it('does nothing without a downbeat — seconds cannot be derived', () => {
    // A no-grid detection placed seconds-based markers; a chart edit must not
    // wipe them when the grid cannot anchor any header.
    const setSections = vi.fn()
    syncStructureMarkersFromChart('[Couplet]\n| C |', [], { setSections })
    expect(setSections).not.toHaveBeenCalled()
  })
})
