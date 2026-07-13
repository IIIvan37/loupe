// @vitest-environment jsdom
import {
  type BeatGrid,
  ChordDetectionError,
  type ChordDetector,
  type DecodedAudio
} from '@app/core'
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useChordDetection } from './use-chord-detection.ts'

const AUDIO: DecodedAudio = { sampleRate: 4, channels: [[0, 1, -1, 0.5]] }

/** A one-bar grid: a downbeat at 0, the detection spans [0, 2). */
const GRID: BeatGrid = [
  { timeSeconds: 0, downbeat: true },
  { timeSeconds: 1, downbeat: false }
]

function detectorOf(labels: readonly string[]): ChordDetector {
  return {
    detect: async () =>
      labels.map((label, index) => ({
        startSeconds: index * 2,
        endSeconds: index * 2 + 2,
        label
      }))
  }
}

/** A detector whose resolution the test controls. */
function gatedDetector(): ChordDetector & { release: () => void } {
  let open = () => {}
  const gate = new Promise<void>((resolve) => {
    open = resolve
  })
  return {
    async detect() {
      await gate
      return [{ startSeconds: 0, endSeconds: 2, label: 'C' }]
    },
    release: () => open()
  }
}

describe('useChordDetection', () => {
  it('drafts the detected chart source through onDraft', async () => {
    const onDraft = vi.fn()
    const { result } = renderHook(() =>
      useChordDetection({
        loadedAudio: AUDIO,
        grid: GRID,
        onDraft,
        detector: detectorOf(['C'])
      })
    )
    await act(() => result.current.detect(4))
    expect(onDraft).toHaveBeenCalledWith(expect.stringContaining('| C |'))
    expect(result.current.succeeded).toBe(true)
  })

  it('wraps the draft at the given bars-per-row', async () => {
    const onDraft = vi.fn()
    const grid: BeatGrid = [0, 2, 4].map((timeSeconds) => ({
      timeSeconds,
      downbeat: true
    }))
    const { result } = renderHook(() =>
      useChordDetection({
        loadedAudio: AUDIO,
        grid,
        onDraft,
        detector: detectorOf(['C', 'G', 'Am'])
      })
    )
    await act(() => result.current.detect(2))
    expect(onDraft).toHaveBeenCalledWith(
      expect.stringContaining('| C | G |\n| Am |')
    )
  })

  it('reports the busy state while a detection is in flight', async () => {
    const detector = gatedDetector()
    const { result } = renderHook(() =>
      useChordDetection({
        loadedAudio: AUDIO,
        grid: GRID,
        onDraft: vi.fn(),
        detector
      })
    )
    let run: Promise<void> = Promise.resolve()
    act(() => {
      run = result.current.detect(4)
    })
    expect(result.current.detecting).toBe(true)
    detector.release()
    await act(() => run)
    expect(result.current.detecting).toBe(false)
  })

  it('surfaces a failed detection as an error code, clearing on the next run', async () => {
    const boom: ChordDetector = {
      detect: async () => {
        throw new Error('chord engine down')
      }
    }
    const onDraft = vi.fn()
    const { result, rerender } = renderHook(
      ({ detector }: { detector: ChordDetector }) =>
        useChordDetection({
          loadedAudio: AUDIO,
          grid: GRID,
          onDraft,
          detector
        }),
      { initialProps: { detector: boom } }
    )
    await act(() => result.current.detect(4))
    expect(result.current.error).toBe('unknown')
    expect(onDraft).not.toHaveBeenCalled()

    rerender({ detector: detectorOf(['C']) })
    await act(() => result.current.detect(4))
    expect(result.current.error).toBeUndefined()
    expect(onDraft).toHaveBeenCalledWith(expect.stringContaining('| C |'))
  })

  it('surfaces the typed code a ChordDetectionError carries', async () => {
    const engineDown: ChordDetector = {
      detect: async () => {
        throw new ChordDetectionError('engine-unavailable', 'HTTP 503')
      }
    }
    const { result } = renderHook(() =>
      useChordDetection({
        loadedAudio: AUDIO,
        grid: GRID,
        onDraft: vi.fn(),
        detector: engineDown
      })
    )
    await act(() => result.current.detect(4))
    expect(result.current.error).toBe('engine-unavailable')
  })

  it('logs the raw failure detail to the console for diagnosis', async () => {
    const logged = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    const engineDown: ChordDetector = {
      detect: async () => {
        throw new ChordDetectionError('engine-unavailable', 'HTTP 503')
      }
    }
    const { result } = renderHook(() =>
      useChordDetection({
        loadedAudio: AUDIO,
        grid: GRID,
        onDraft: vi.fn(),
        detector: engineDown
      })
    )
    await act(() => result.current.detect(4))
    expect(logged).toHaveBeenCalledWith(
      'chord detection failed:',
      'engine-unavailable',
      'HTTP 503'
    )
    logged.mockRestore()
  })

  it('drops a late result when the track was replaced mid-flight', async () => {
    const detector = gatedDetector()
    const onDraft = vi.fn()
    const { result, rerender } = renderHook(
      ({ audio }: { audio: DecodedAudio }) =>
        useChordDetection({
          loadedAudio: audio,
          grid: GRID,
          onDraft,
          detector
        }),
      { initialProps: { audio: AUDIO } }
    )
    let run: Promise<void> = Promise.resolve()
    act(() => {
      run = result.current.detect(4)
    })
    rerender({ audio: { sampleRate: 4, channels: [[0.5]] } })
    detector.release()
    await act(() => run)
    // The new track must not inherit the old track's chart.
    expect(onDraft).not.toHaveBeenCalled()
    expect(result.current.detecting).toBe(false)
  })

  it('aborts the in-flight run when the track is replaced', async () => {
    // Dropping the late result is not enough: the pending upload still holds
    // the server's analysis slot, so the transfer itself must be aborted.
    let seenSignal: AbortSignal | undefined
    const pending: ChordDetector = {
      detect: (_audio, signal) => {
        seenSignal = signal
        return new Promise(() => {})
      }
    }
    const { result, rerender } = renderHook(
      ({ audio }: { audio: DecodedAudio }) =>
        useChordDetection({
          loadedAudio: audio,
          grid: GRID,
          onDraft: vi.fn(),
          detector: pending
        }),
      { initialProps: { audio: AUDIO } }
    )
    act(() => {
      void result.current.detect(4)
    })
    expect(seenSignal?.aborted).toBe(false)
    rerender({ audio: { sampleRate: 4, channels: [[0.5]] } })
    expect(seenSignal?.aborted).toBe(true)
  })

  it('aborts the previous run when a new detection starts', async () => {
    const signals: AbortSignal[] = []
    const pending: ChordDetector = {
      detect: (_audio, signal) => {
        if (signal) {
          signals.push(signal)
        }
        return new Promise(() => {})
      }
    }
    const { result } = renderHook(() =>
      useChordDetection({
        loadedAudio: AUDIO,
        grid: GRID,
        onDraft: vi.fn(),
        detector: pending
      })
    )
    act(() => {
      void result.current.detect(4)
    })
    act(() => {
      void result.current.detect(4)
    })
    expect(signals[0]?.aborted).toBe(true)
    expect(signals[1]?.aborted).toBe(false)
  })

  it('does nothing without loaded audio', async () => {
    const detect = vi.fn()
    const { result } = renderHook(() =>
      useChordDetection({
        loadedAudio: undefined,
        grid: GRID,
        onDraft: vi.fn(),
        detector: { detect }
      })
    )
    await act(() => result.current.detect(4))
    expect(detect).not.toHaveBeenCalled()
  })
})
