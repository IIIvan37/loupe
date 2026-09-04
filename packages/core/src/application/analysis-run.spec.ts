import { describe, expect, it } from 'vitest'
import { isRunCurrent } from './analysis-run.ts'

describe('isRunCurrent', () => {
  it('commits a run nothing superseded', () => {
    expect(
      isRunCurrent({
        started: { runId: 1, track: 'a' },
        current: { runId: 1, track: 'a' },
        aborted: false
      })
    ).toBe(true)
  })

  it('discards a run a newer one superseded', () => {
    expect(
      isRunCurrent({
        started: { runId: 1, track: 'a' },
        current: { runId: 2, track: 'a' },
        aborted: false
      })
    ).toBe(false)
  })

  it('discards a run whose track was replaced since it started', () => {
    expect(
      isRunCurrent({
        started: { runId: 1, track: 'a' },
        current: { runId: 1, track: 'b' },
        aborted: false
      })
    ).toBe(false)
  })

  it('discards a run whose own transfer was aborted', () => {
    expect(
      isRunCurrent({
        started: { runId: 1, track: 'a' },
        current: { runId: 1, track: 'a' },
        aborted: true
      })
    ).toBe(false)
  })
})
