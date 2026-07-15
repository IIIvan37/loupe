// @vitest-environment jsdom

import type { Project } from '@app/core'
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useAnalysisFold } from './use-analysis-fold.ts'

/** The manifest bits the fold policy reads: a tempo and a chart source. */
function projectOf(overrides: Partial<Project> = {}): Project {
  return {
    id: 'p1',
    name: 'demo',
    createdAt: 0,
    updatedAt: 0,
    source: { title: 'demo', artist: undefined, audioRef: 'blob' },
    loops: [],
    markers: [],
    ...overrides
  }
}

const analysed = () =>
  projectOf({
    tempo: {
      bpm: 120,
      grid: [],
      beatsPerBar: 4,
      metronome: { id: 'click', gainDb: 0, muted: false, soloed: false }
    },
    chordChart: { source: '| C |' }
  })

beforeEach(() => localStorage.clear())

describe('useAnalysisFold', () => {
  it('opens by default and persists only the manual toggle', () => {
    const { result } = renderHook(() => useAnalysisFold())
    expect(result.current.open).toBe(true)
    expect(localStorage.getItem('loupe.analyser.open')).toBeNull()

    act(() => result.current.toggle())
    expect(result.current.open).toBe(false)
    expect(localStorage.getItem('loupe.analyser.open')).toBe('false')
  })

  it('folds a reopened, fully-analysed project into practice mode', () => {
    const { result } = renderHook(() => useAnalysisFold())
    act(() => result.current.seatForRestoredProject(analysed()))
    expect(result.current.open).toBe(false)
    // The default seat is not a choice — nothing sticks.
    expect(localStorage.getItem('loupe.analyser.open')).toBeNull()
  })

  it('keeps an incomplete reopened project unfolded', () => {
    const { result } = renderHook(() => useAnalysisFold())
    act(() => result.current.seatForRestoredProject(projectOf()))
    expect(result.current.open).toBe(true)
  })

  it('reopens the zone on a fresh import after a practice fold', () => {
    const { result } = renderHook(() => useAnalysisFold())
    act(() => result.current.seatForRestoredProject(analysed()))
    act(() => result.current.seatForFreshImport())
    expect(result.current.open).toBe(true)
  })

  it('lets the stored manual choice win over every default', () => {
    localStorage.setItem('loupe.analyser.open', 'false')
    const { result } = renderHook(() => useAnalysisFold())
    expect(result.current.open).toBe(false)

    act(() => result.current.seatForFreshImport())
    expect(result.current.open).toBe(false)
    act(() => result.current.seatForRestoredProject(projectOf()))
    expect(result.current.open).toBe(false)
  })
})
