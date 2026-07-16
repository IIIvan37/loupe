import { describe, expect, it } from 'vitest'
import {
  initialSeparation,
  type SeparationState,
  separationReducer
} from './separation.ts'
import type { StemSet } from './stem-set.ts'

const stems: StemSet = [
  {
    id: 'vox',
    label: 'Voix',
    track: { sampleRate: 4, durationSeconds: 1, waveform: { peaks: [] } },
    confidence: 1,
    present: true
  }
]

describe('separationReducer', () => {
  it('is idle, empty and unprogressed before any separation', () => {
    expect(initialSeparation).toEqual({
      status: 'idle',
      progress: 0,
      stems: [],
      error: undefined
    })
  })

  it('starts in the analysing phase, cleared of any prior result', () => {
    const prior: SeparationState = {
      status: 'error',
      progress: 0.4,
      stems,
      error: { code: 'unknown', detail: 'boom' }
    }
    expect(separationReducer(prior, { type: 'start' })).toEqual({
      status: 'analysing',
      progress: 0,
      stems: [],
      error: undefined
    })
  })

  it('takes its status from the reported progress phase', () => {
    const analysing = separationReducer(initialSeparation, {
      type: 'progress',
      phase: 'analysing',
      fraction: 0.3
    })
    expect(analysing).toMatchObject({ status: 'analysing', progress: 0.3 })

    const separating = separationReducer(analysing, {
      type: 'progress',
      phase: 'separating',
      fraction: 0.7
    })
    expect(separating).toMatchObject({ status: 'separating', progress: 0.7 })
  })

  it('confines progress to [0, 1]', () => {
    expect(
      separationReducer(initialSeparation, {
        type: 'progress',
        phase: 'separating',
        fraction: 1.5
      }).progress
    ).toBe(1)
    expect(
      separationReducer(initialSeparation, {
        type: 'progress',
        phase: 'separating',
        fraction: -0.2
      }).progress
    ).toBe(0)
  })

  it('reaches ready with the produced stems at full progress', () => {
    const ready = separationReducer(
      { status: 'separating', progress: 0.9, stems: [], error: undefined },
      { type: 'ready', stems }
    )
    expect(ready).toEqual({
      status: 'ready',
      progress: 1,
      stems,
      error: undefined
    })
  })

  it('records the typed failure — code for the UI copy, detail for the console', () => {
    const failed = separationReducer(initialSeparation, {
      type: 'fail',
      code: 'network',
      detail: 'fetch failed'
    })
    expect(failed).toMatchObject({
      status: 'error',
      error: { code: 'network', detail: 'fetch failed' }
    })
  })

  it('resets back to the idle initial state', () => {
    expect(
      separationReducer(
        { status: 'ready', progress: 1, stems, error: undefined },
        { type: 'reset' }
      )
    ).toBe(initialSeparation)
  })
})
