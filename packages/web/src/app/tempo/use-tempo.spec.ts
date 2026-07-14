// @vitest-environment jsdom
import type { DecodedAudio, TempoDetector } from '@app/core'
import { TempoDetectionError } from '@app/core'
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useTempo } from './use-tempo.ts'

const audio: DecodedAudio = { sampleRate: 4, channels: [[0, 1, -1, 0.5]] }

function detectorOf(bpm: number, beatTimes: number[]): TempoDetector {
  return {
    detect: async () => ({
      bpm,
      beats: beatTimes.map((timeSeconds, index) => ({
        timeSeconds,
        barPosition: (index % 4) + 1
      }))
    })
  }
}

describe('useTempo', () => {
  it('starts idle with no analysis', () => {
    const { result } = renderHook(() => useTempo(detectorOf(120, [])))
    expect(result.current.analysis).toBeUndefined()
    expect(result.current.detecting).toBe(false)
  })

  it('exposes the detected BPM and grid after a run', async () => {
    const { result } = renderHook(() => useTempo(detectorOf(120, [0, 0.5, 1])))
    await act(async () => {
      await result.current.detect(audio)
    })
    expect(result.current.analysis?.bpm).toBe(120)
    expect(result.current.analysis?.grid).toHaveLength(3)
  })

  it('surfaces an untyped detector failure as the unknown code', async () => {
    const boom: TempoDetector = {
      detect: async () => {
        throw new Error('server down')
      }
    }
    const { result } = renderHook(() => useTempo(boom))
    await act(async () => {
      await result.current.detect(audio)
    })
    expect(result.current.error).toBe('unknown')
  })

  it('surfaces a typed detector failure as its code', async () => {
    const down: TempoDetector = {
      detect: async () => {
        throw new TempoDetectionError('network', 'fetch failed')
      }
    }
    const { result } = renderHook(() => useTempo(down))
    await act(async () => {
      await result.current.detect(audio)
    })
    expect(result.current.error).toBe('network')
  })

  it('aborts the in-flight detection when reset supersedes it', async () => {
    // A pending run holds the server's analysis slot — a reset (new track)
    // must abort the transfer, not just drop the late result.
    let seenSignal: AbortSignal | undefined
    const pending: TempoDetector = {
      detect: (_audio, signal) => {
        seenSignal = signal
        return new Promise(() => {})
      }
    }
    const { result } = renderHook(() => useTempo(pending))
    act(() => {
      void result.current.detect(audio)
    })
    act(() => result.current.reset())
    expect(seenSignal?.aborted).toBe(true)
  })

  it('aborts the previous run when a new detection starts', async () => {
    const signals: AbortSignal[] = []
    const pending: TempoDetector = {
      detect: (_audio, signal) => {
        if (signal) {
          signals.push(signal)
        }
        return new Promise(() => {})
      }
    }
    const { result } = renderHook(() => useTempo(pending))
    act(() => {
      void result.current.detect(audio)
    })
    act(() => {
      void result.current.detect(audio)
    })
    expect(signals[0]?.aborted).toBe(true)
    expect(signals[1]?.aborted).toBe(false)
  })

  it('aborts the in-flight detection on unmount', async () => {
    let seenSignal: AbortSignal | undefined
    const pending: TempoDetector = {
      detect: (_audio, signal) => {
        seenSignal = signal
        return new Promise(() => {})
      }
    }
    const { result, unmount } = renderHook(() => useTempo(pending))
    act(() => {
      void result.current.detect(audio)
    })
    unmount()
    expect(seenSignal?.aborted).toBe(true)
  })

  it('aborts the in-flight detection when a manual tempo supersedes it', async () => {
    let seenSignal: AbortSignal | undefined
    const pending: TempoDetector = {
      detect: (_audio, signal) => {
        seenSignal = signal
        return new Promise(() => {})
      }
    }
    const { result } = renderHook(() => useTempo(pending))
    act(() => {
      void result.current.detect(audio)
    })
    act(() => {
      result.current.overrideBpm(120, 10)
    })
    expect(seenSignal?.aborted).toBe(true)
  })

  it('clears the analysis on reset', async () => {
    const { result } = renderHook(() => useTempo(detectorOf(120, [0, 1])))
    await act(async () => {
      await result.current.detect(audio)
    })
    act(() => result.current.reset())
    expect(result.current.analysis).toBeUndefined()
  })

  it('has a zero octave shift after a fresh detection', async () => {
    const { result } = renderHook(() => useTempo(detectorOf(120, [0, 0.5])))
    await act(async () => {
      await result.current.detect(audio)
    })
    expect(result.current.octaveShift).toBe(0)
  })

  it('doubles the BPM when folding up an octave', async () => {
    const { result } = renderHook(() => useTempo(detectorOf(120, [0, 0.5, 1])))
    await act(async () => {
      await result.current.detect(audio)
    })
    act(() => {
      result.current.fold(2)
    })
    expect(result.current.analysis?.bpm).toBe(240)
  })

  it('tracks the octave shift as it folds', async () => {
    const { result } = renderHook(() => useTempo(detectorOf(120, [0, 0.5, 1])))
    await act(async () => {
      await result.current.detect(audio)
    })
    act(() => {
      result.current.fold(0.5)
    })
    expect(result.current.octaveShift).toBe(-1)
  })

  it('stops folding at the octave bound', async () => {
    const { result } = renderHook(() =>
      useTempo(detectorOf(120, [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5]))
    )
    await act(async () => {
      await result.current.detect(audio)
    })
    act(() => result.current.fold(0.5))
    act(() => result.current.fold(0.5))
    act(() => result.current.fold(0.5))
    expect(result.current.octaveShift).toBe(-2)
  })

  it('restores a persisted octave shift on set', () => {
    const { result } = renderHook(() => useTempo(detectorOf(120, [])))
    act(() => {
      result.current.set({ bpm: 60, grid: [], beatsPerBar: 4 }, -1)
    })
    expect(result.current.octaveShift).toBe(-1)
  })

  it('overrides the tempo manually when nothing was detected', () => {
    const { result } = renderHook(() => useTempo(detectorOf(120, [])))
    act(() => {
      result.current.overrideBpm(100, 3)
    })
    expect(result.current.analysis?.bpm).toBe(100)
    // 100 BPM over 3 s from phase 0: beats at 0, 0.6, 1.2, 1.8, 2.4, 3.
    expect(result.current.analysis?.grid.map((b) => b.timeSeconds)).toEqual([
      0, 0.6, 1.2, 1.8, 2.4, 3
    ])
    expect(result.current.manual).toEqual({ bpm: 100, phaseSeconds: 0 })
  })

  it('keeps the detected downbeat phase when overriding the BPM', async () => {
    // Detected grid: downbeat at 0.5 (barPosition 1 lands on the first beat).
    const { result } = renderHook(() =>
      useTempo(detectorOf(120, [0.5, 1, 1.5, 2]))
    )
    await act(async () => {
      await result.current.detect(audio)
    })
    act(() => {
      result.current.overrideBpm(60, 3)
    })
    // The new grid stays anchored on the detected downbeat: …0.5 ± k·1 s.
    expect(result.current.analysis?.grid.map((b) => b.timeSeconds)).toEqual([
      0.5, 1.5, 2.5
    ])
    expect(result.current.manual).toEqual({ bpm: 60, phaseSeconds: 0.5 })
  })

  it('keeps the detected meter when overriding the BPM', async () => {
    const { result } = renderHook(() =>
      useTempo(detectorOf(120, [0, 0.5, 1, 1.5, 2, 2.5]))
    )
    await act(async () => {
      await result.current.detect(audio)
    })
    act(() => {
      result.current.overrideBpm(60, 3)
    })
    expect(result.current.analysis?.beatsPerBar).toBe(4)
  })

  it('rejects a non-positive or non-finite manual BPM', async () => {
    const { result } = renderHook(() => useTempo(detectorOf(120, [0, 0.5])))
    await act(async () => {
      await result.current.detect(audio)
    })
    act(() => {
      // Number('') is 0 — an emptied field must not become a tempo.
      expect(result.current.overrideBpm(0, 3)).toBeUndefined()
      expect(result.current.overrideBpm(Number.NaN, 3)).toBeUndefined()
      expect(result.current.overrideBpm(-60, 3)).toBeUndefined()
    })
    expect(result.current.analysis?.bpm).toBe(120)
    expect(result.current.manual).toBeUndefined()
  })

  it('resets the octave shift on a manual override', async () => {
    const { result } = renderHook(() => useTempo(detectorOf(120, [0, 0.5, 1])))
    await act(async () => {
      await result.current.detect(audio)
    })
    act(() => result.current.fold(2))
    act(() => {
      result.current.overrideBpm(100, 3)
    })
    expect(result.current.octaveShift).toBe(0)
  })

  it('anchors a downbeat at the playhead on alignPhase', async () => {
    const { result } = renderHook(() => useTempo(detectorOf(120, [0, 0.5, 1])))
    await act(async () => {
      await result.current.detect(audio)
    })
    let aligned: ReturnType<typeof result.current.alignPhase>
    act(() => {
      aligned = result.current.alignPhase(0.25, 1)
    })
    const beats = result.current.analysis?.grid
    const anchor = beats?.find((b) => b.timeSeconds === 0.25)
    expect(anchor?.downbeat).toBe(true)
    expect(result.current.manual).toEqual({ bpm: 120, phaseSeconds: 0.25 })
    expect(aligned).toBe(result.current.analysis)
  })

  it('cannot align the phase before any tempo exists', () => {
    const { result } = renderHook(() => useTempo(detectorOf(120, [])))
    act(() => {
      expect(result.current.alignPhase(1, 3)).toBeUndefined()
    })
    expect(result.current.analysis).toBeUndefined()
  })

  it('folds the manual override along with the analysis', async () => {
    const { result } = renderHook(() => useTempo(detectorOf(120, [0, 0.5])))
    await act(async () => {
      await result.current.detect(audio)
    })
    act(() => {
      result.current.overrideBpm(100, 3)
    })
    act(() => result.current.fold(0.5))
    expect(result.current.analysis?.bpm).toBe(50)
    expect(result.current.manual?.bpm).toBe(50)
  })

  it('clears the manual override on a fresh detection', async () => {
    const { result } = renderHook(() => useTempo(detectorOf(120, [0, 0.5])))
    act(() => {
      result.current.overrideBpm(100, 3)
    })
    await act(async () => {
      await result.current.detect(audio)
    })
    expect(result.current.manual).toBeUndefined()
    expect(result.current.analysis?.bpm).toBe(120)
  })

  it('clears the manual override on reset', () => {
    const { result } = renderHook(() => useTempo(detectorOf(120, [])))
    act(() => {
      result.current.overrideBpm(100, 3)
    })
    act(() => result.current.reset())
    expect(result.current.manual).toBeUndefined()
  })

  it('restores a persisted manual override on set', () => {
    const { result } = renderHook(() => useTempo(detectorOf(120, [])))
    act(() => {
      result.current.set({ bpm: 90, grid: [], beatsPerBar: 4 }, 0, {
        bpm: 90,
        phaseSeconds: 1.5
      })
    })
    expect(result.current.manual).toEqual({ bpm: 90, phaseSeconds: 1.5 })
  })

  it('seating a persisted analysis without an override clears any manual', () => {
    const { result } = renderHook(() => useTempo(detectorOf(120, [])))
    act(() => {
      result.current.overrideBpm(100, 3)
    })
    act(() => {
      result.current.set({ bpm: 90, grid: [], beatsPerBar: 4 }, 0)
    })
    expect(result.current.manual).toBeUndefined()
  })

  it('discards a stale run superseded by a reset', async () => {
    let release: (() => void) | undefined
    const gated: TempoDetector = {
      detect: () =>
        new Promise((resolve) => {
          release = () =>
            resolve({ bpm: 90, beats: [{ timeSeconds: 0, barPosition: 1 }] })
        })
    }
    const { result } = renderHook(() => useTempo(gated))
    let pending: Promise<unknown> | undefined
    act(() => {
      pending = result.current.detect(audio)
    })
    act(() => result.current.reset())
    await act(async () => {
      release?.()
      await pending
    })
    // The reset superseded the in-flight detect — its late result is dropped.
    expect(result.current.analysis).toBeUndefined()
  })
})

describe('useTempo — meter correction', () => {
  it('re-flags the grid downbeats on a meter correction', async () => {
    const times = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5]
    const { result } = renderHook(() => useTempo(detectorOf(120, times)))
    await act(async () => {
      await result.current.detect(audio)
    })
    let corrected: ReturnType<typeof result.current.overrideMeter>
    act(() => {
      corrected = result.current.overrideMeter(2)
    })
    expect(result.current.analysis?.beatsPerBar).toBe(2)
    expect(result.current.analysis?.grid.map((beat) => beat.downbeat)).toEqual([
      true,
      false,
      true,
      false,
      true,
      false,
      true,
      false
    ])
    // The corrected analysis is returned so the caller can re-seat the click.
    expect(corrected).toBe(result.current.analysis)
  })

  it('keeps every beat instant through a meter correction', async () => {
    const times = [0, 0.5, 1, 1.5]
    const { result } = renderHook(() => useTempo(detectorOf(120, times)))
    await act(async () => {
      await result.current.detect(audio)
    })
    act(() => {
      result.current.overrideMeter(3)
    })
    expect(
      result.current.analysis?.grid.map((beat) => beat.timeSeconds)
    ).toEqual(times)
    expect(result.current.analysis?.bpm).toBe(120)
  })

  it('cannot correct the meter before any analysis exists', () => {
    const { result } = renderHook(() => useTempo(detectorOf(120, [])))
    let corrected: ReturnType<typeof result.current.overrideMeter>
    act(() => {
      corrected = result.current.overrideMeter(3)
    })
    expect(corrected).toBeUndefined()
  })

  it('re-committing the current meter still regularises the grid', async () => {
    // The dominant can be right while stray bars are wrong (a detector slip):
    // typing the same number is a deliberate correction, not a no-op.
    const slipped: TempoDetector = {
      detect: async () => ({
        bpm: 120,
        beats: [1, 2, 3, 4, 1, 2, 3, 4, 5, 6, 1, 2, 3, 4].map(
          (barPosition, index) => ({ timeSeconds: index * 0.5, barPosition })
        )
      })
    }
    const { result } = renderHook(() => useTempo(slipped))
    await act(async () => {
      await result.current.detect(audio)
    })
    expect(result.current.analysis?.beatsPerBar).toBe(4)
    act(() => {
      result.current.overrideMeter(4)
    })
    // Every bar is four beats now — the six-beat slip is gone.
    expect(
      result.current.analysis?.grid.filter((beat) => beat.downbeat)
    ).toHaveLength(4)
  })

  it('a meter correction clears a stale detection error', async () => {
    let fail = false
    const flaky: TempoDetector = {
      detect: async () => {
        if (fail) throw new Error('server down')
        return {
          bpm: 120,
          beats: [0, 0.5, 1, 1.5, 2].map((timeSeconds, index) => ({
            timeSeconds,
            barPosition: (index % 4) + 1
          }))
        }
      }
    }
    const { result } = renderHook(() => useTempo(flaky))
    await act(async () => {
      await result.current.detect(audio)
    })
    fail = true
    await act(async () => {
      await result.current.detect(audio)
    })
    expect(result.current.error).toBe('unknown')
    act(() => {
      result.current.overrideMeter(3)
    })
    expect(result.current.error).toBeUndefined()
  })

  it('rejects a degenerate or out-of-range meter', async () => {
    const { result } = renderHook(() =>
      useTempo(detectorOf(120, [0, 0.5, 1, 1.5, 2]))
    )
    await act(async () => {
      await result.current.detect(audio)
    })
    for (const bad of [0, -1, Number.NaN, 13]) {
      let corrected: ReturnType<typeof result.current.overrideMeter>
      act(() => {
        corrected = result.current.overrideMeter(bad)
      })
      expect(corrected).toBeUndefined()
    }
    expect(result.current.analysis?.beatsPerBar).toBe(4)
  })
})
