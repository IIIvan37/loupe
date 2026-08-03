// @vitest-environment jsdom
import type { BeatGrid, TempoAnalysis } from '@app/core'
import { act, renderHook } from '@testing-library/react'
import { Provider } from 'jotai'
import { describe, expect, it } from 'vitest'
import { useMarkers } from '../../markers/use-markers.ts'
import { useChartWithStructure } from './use-chart-with-structure.ts'

/** A grid of `bars` measures, 2 beats each: downbeats at 0 s, 2 s, 4 s, … */
function grid(bars: number): BeatGrid {
  return Array.from({ length: bars * 2 }, (_, index) => ({
    timeSeconds: index,
    downbeat: index % 2 === 0
  }))
}

function analysisOf(bars: number): TempoAnalysis {
  return { bpm: 120, grid: grid(bars), beatsPerBar: 2 }
}

function mountPairing(analysis: TempoAnalysis | undefined) {
  return renderHook(
    () => {
      const markers = useMarkers()
      const { chordChart } = useChartWithStructure({
        loadedAudio: undefined,
        analysis,
        markers,
        separation: { sources: [], cancel: () => {} },
        separateAndLoad: async () => undefined,
        // Never run here — injected so the real adapters (which need the
        // analysis endpoint) are not built.
        chordDetector: { detect: async () => [] },
        structureDetector: { detect: async () => [] }
      })
      return { markers, chordChart }
    },
    { wrapper: Provider }
  )
}

/** Seat a two-section chart; the edit sync derives its structure markers. */
function seedTwoSections(result: ReturnType<typeof mountPairing>['result']) {
  act(() =>
    result.current.chordChart.setSource(
      '[Couplet]\n| C | Am |\n\n[Refrain]\n| F | G |'
    )
  )
}

describe('useChartWithStructure — marker edits relabel the chart', () => {
  it('renaming a structure marker renames its header, chords kept', () => {
    const { result } = mountPairing(analysisOf(4))
    seedTwoSections(result)
    const refrain = result.current.markers.markers.find(
      (marker) => marker.label === 'Refrain'
    )

    act(() => result.current.markers.rename(refrain?.id ?? '', 'Pont'))

    expect(result.current.chordChart.source).toBe(
      '[Couplet]\n| C | Am |\n\n[Pont]\n| F | G |'
    )
  })

  it('moving a structure marker moves the section boundary', () => {
    const { result } = mountPairing(analysisOf(4))
    seedTwoSections(result)
    const refrain = result.current.markers.markers.find(
      (marker) => marker.label === 'Refrain'
    )

    // From bar 2 (4 s) back to bar 1 (2 s): the refrain now opens on | Am |.
    act(() => result.current.markers.move(refrain?.id ?? '', 2))

    expect(result.current.chordChart.source).toBe(
      '[Couplet]\n| C |\n\n[Refrain]\n| Am | F | G |'
    )
  })

  it('removing the last structure marker strips the headers', () => {
    const { result } = mountPairing(analysisOf(4))
    act(() => result.current.chordChart.setSource('[Couplet]\n| C | Am |'))
    const couplet = result.current.markers.markers[0]

    act(() => result.current.markers.remove(couplet?.id ?? ''))

    expect(result.current.chordChart.source).toBe('| C | Am |')
    expect(result.current.markers.markers).toHaveLength(0)
  })

  it('relabels silently — the markers are not re-minted by the bounce', () => {
    const { result } = mountPairing(analysisOf(4))
    seedTwoSections(result)
    const ids = result.current.markers.markers.map((marker) => marker.id)
    const refrain = result.current.markers.markers[1]

    act(() => result.current.markers.rename(refrain?.id ?? '', 'Pont'))

    // A relabel through the edited surface would re-derive the markers and
    // mint fresh ids mid-gesture; the marker list must keep its identities.
    expect(result.current.markers.markers.map((marker) => marker.id)).toEqual(
      ids
    )
  })

  it('keeps the transposition offset — a relabel changes no chord', () => {
    const { result } = mountPairing(analysisOf(4))
    seedTwoSections(result)
    act(() => result.current.chordChart.transpose(2))
    const offset = result.current.chordChart.transposedBy
    const refrain = result.current.markers.markers[1]

    act(() => result.current.markers.rename(refrain?.id ?? '', 'Pont'))

    expect(result.current.chordChart.transposedBy).toBe(offset)
  })

  it('leaves the chart alone when a cue is edited', () => {
    const { result } = mountPairing(analysisOf(4))
    seedTwoSections(result)
    const before = result.current.chordChart.source

    act(() => result.current.markers.addAt(3))
    const cue = result.current.markers.markers.find(
      (marker) => marker.kind !== 'structure'
    )
    act(() => result.current.markers.rename(cue?.id ?? '', 'Solo'))

    expect(result.current.chordChart.source).toBe(before)
  })

  it('leaves the chart alone without a downbeat to place bars on', () => {
    const { result } = mountPairing(undefined)
    act(() => result.current.chordChart.setSource('| C | Am |'))

    act(() => result.current.markers.addSectionAt(0))

    expect(result.current.chordChart.source).toBe('| C | Am |')
  })

  it('unseats the sync on unmount — no edit reaches a dead chart', () => {
    const first = mountPairing(analysisOf(4))
    seedTwoSections(first.result)
    first.unmount()

    // A fresh store starts clean; the previous mount's handler must be gone.
    const second = mountPairing(analysisOf(4))
    act(() => second.result.current.markers.addSectionAt(0))
    expect(second.result.current.chordChart.source).toBe('')
  })
})
