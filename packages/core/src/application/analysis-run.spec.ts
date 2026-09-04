import { describe, expect, it } from 'vitest'
import { isRunCurrent } from './analysis-run.ts'

describe('isRunCurrent', () => {
  it('commits a run nothing superseded', () => {
    expect(
      isRunCurrent({ runId: 1, track: 'a' }, { runId: 1, track: 'a' }, false)
    ).toBe(true)
  })

  it('discards a run a newer one superseded', () => {
    expect(
      isRunCurrent({ runId: 1, track: 'a' }, { runId: 2, track: 'a' }, false)
    ).toBe(false)
  })

  it('discards a run whose track was replaced since it started', () => {
    expect(
      isRunCurrent({ runId: 1, track: 'a' }, { runId: 1, track: 'b' }, false)
    ).toBe(false)
  })

  it('discards a run whose own transfer was aborted', () => {
    expect(
      isRunCurrent({ runId: 1, track: 'a' }, { runId: 1, track: 'a' }, true)
    ).toBe(false)
  })
})
