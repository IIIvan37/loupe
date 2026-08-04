import { describe, expect, it } from 'vitest'
import {
  initialSeparation,
  isSeparationPhase,
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
      progress: undefined,
      stems: [],
      error: undefined
    })
  })

  it('starts with progress unknown, cleared of any prior result', () => {
    // No fraction until the engine reports one: the bar must stay indeterminate
    // through mint, cold start and upload — `0%` there is a lie.
    const prior: SeparationState = {
      status: 'error',
      progress: 0.4,
      stems,
      error: { code: 'unknown', detail: 'boom' }
    }
    expect(separationReducer(prior, { type: 'start' })).toEqual({
      status: 'analysing',
      progress: undefined,
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

  it('narrates the retrieval after the engine finishes — no more frozen 100 %', () => {
    // After the last engine tick the stems still have to download and decode
    // (~250 MB): the adapter reports that as its own phase with a real
    // stems-landed fraction (AS.2).
    const retrieving = separationReducer(
      { status: 'separating', progress: 1, stems: [], error: undefined },
      { type: 'progress', phase: 'retrieving', fraction: 0.5 }
    )
    expect(retrieving).toMatchObject({ status: 'retrieving', progress: 0.5 })
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

describe('isSeparationPhase', () => {
  it('recognises every running phase and nothing else', () => {
    expect(isSeparationPhase('analysing')).toBe(true)
    expect(isSeparationPhase('separating')).toBe(true)
    expect(isSeparationPhase('retrieving')).toBe(true)
    expect(isSeparationPhase('idle')).toBe(false)
    expect(isSeparationPhase('ready')).toBe(false)
    expect(isSeparationPhase('error')).toBe(false)
  })
})
