// @vitest-environment jsdom
import {
  type BeatGrid,
  type DecodedAudio,
  type DetectedSection,
  StructureDetectionError,
  type StructureDetector
} from '@app/core'
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useStructureDetection } from './use-structure-detection.ts'

const AUDIO: DecodedAudio = { sampleRate: 4, channels: [[0, 1, -1, 0.5]] }

/** No grid needed — structure detection works before the tempo is known. */
const NO_GRID: BeatGrid = []

function detectorOf(sections: readonly DetectedSection[]): StructureDetector {
  return { detect: async () => sections }
}

/** A detector whose resolution the test controls. */
function gatedDetector(): StructureDetector & { release: () => void } {
  let open = () => {}
  const gate = new Promise<void>((resolve) => {
    open = resolve
  })
  return {
    async detect() {
      await gate
      return [{ startSeconds: 0, endSeconds: 12, label: 'intro' }]
    },
    release: () => open()
  }
}

describe('useStructureDetection', () => {
  it('hands the detected sections to onSections', async () => {
    const sections: DetectedSection[] = [
      { startSeconds: 0, endSeconds: 12, label: 'intro' },
      { startSeconds: 12, endSeconds: 40, label: 'verse' }
    ]
    const onSections = vi.fn()
    const { result } = renderHook(() =>
      useStructureDetection({
        loadedAudio: AUDIO,
        grid: NO_GRID,
        onSections,
        detector: detectorOf(sections)
      })
    )
    await act(() => result.current.detect())
    expect(onSections).toHaveBeenCalledWith(sections)
    expect(result.current.succeeded).toBe(true)
  })

  it('reports the busy state while a detection is in flight', async () => {
    const detector = gatedDetector()
    const { result } = renderHook(() =>
      useStructureDetection({
        loadedAudio: AUDIO,
        grid: NO_GRID,
        onSections: vi.fn(),
        detector
      })
    )
    let run: Promise<void> = Promise.resolve()
    act(() => {
      run = result.current.detect()
    })
    expect(result.current.detecting).toBe(true)
    detector.release()
    await act(() => run)
    expect(result.current.detecting).toBe(false)
  })

  it('surfaces an empty detection as the no-structure code', async () => {
    const { result } = renderHook(() =>
      useStructureDetection({
        loadedAudio: AUDIO,
        grid: NO_GRID,
        onSections: vi.fn(),
        detector: detectorOf([])
      })
    )
    await act(() => result.current.detect())
    expect(result.current.error).toBe('no-structure')
  })

  it('surfaces a failed detection as an error code, clearing on the next run', async () => {
    const boom: StructureDetector = {
      detect: async () => {
        throw new Error('structure engine down')
      }
    }
    const onSections = vi.fn()
    const { result, rerender } = renderHook(
      ({ detector }: { detector: StructureDetector }) =>
        useStructureDetection({
          loadedAudio: AUDIO,
          grid: NO_GRID,
          onSections,
          detector
        }),
      { initialProps: { detector: boom } }
    )
    await act(() => result.current.detect())
    expect(result.current.error).toBe('unknown')
    expect(onSections).not.toHaveBeenCalled()

    rerender({
      detector: detectorOf([
        { startSeconds: 0, endSeconds: 12, label: 'intro' }
      ])
    })
    await act(() => result.current.detect())
    expect(result.current.error).toBeUndefined()
    expect(onSections).toHaveBeenCalled()
  })

  it('surfaces the typed code a StructureDetectionError carries', async () => {
    const engineDown: StructureDetector = {
      detect: async () => {
        throw new StructureDetectionError('engine-unavailable', 'HTTP 503')
      }
    }
    const { result } = renderHook(() =>
      useStructureDetection({
        loadedAudio: AUDIO,
        grid: NO_GRID,
        onSections: vi.fn(),
        detector: engineDown
      })
    )
    await act(() => result.current.detect())
    expect(result.current.error).toBe('engine-unavailable')
  })

  it('logs the raw failure detail to the console for diagnosis', async () => {
    const logged = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    const engineDown: StructureDetector = {
      detect: async () => {
        throw new StructureDetectionError('engine-unavailable', 'HTTP 503')
      }
    }
    const { result } = renderHook(() =>
      useStructureDetection({
        loadedAudio: AUDIO,
        grid: NO_GRID,
        onSections: vi.fn(),
        detector: engineDown
      })
    )
    await act(() => result.current.detect())
    expect(logged).toHaveBeenCalledWith(
      'structure detection failed:',
      'engine-unavailable',
      'HTTP 503'
    )
    logged.mockRestore()
  })

  it('drops a late result when the track was replaced mid-flight', async () => {
    const detector = gatedDetector()
    const onSections = vi.fn()
    const { result, rerender } = renderHook(
      ({ audio }: { audio: DecodedAudio }) =>
        useStructureDetection({
          loadedAudio: audio,
          grid: NO_GRID,
          onSections,
          detector
        }),
      { initialProps: { audio: AUDIO } }
    )
    let run: Promise<void> = Promise.resolve()
    act(() => {
      run = result.current.detect()
    })
    rerender({ audio: { sampleRate: 4, channels: [[0.5]] } })
    detector.release()
    await act(() => run)
    expect(onSections).not.toHaveBeenCalled()
    expect(result.current.detecting).toBe(false)
  })

  it('aborts the in-flight run when the track is replaced', async () => {
    let seenSignal: AbortSignal | undefined
    const pending: StructureDetector = {
      detect: (_audio, signal) => {
        seenSignal = signal
        return new Promise(() => {})
      }
    }
    const { rerender, result } = renderHook(
      ({ audio }: { audio: DecodedAudio }) =>
        useStructureDetection({
          loadedAudio: audio,
          grid: NO_GRID,
          onSections: vi.fn(),
          detector: pending
        }),
      { initialProps: { audio: AUDIO } }
    )
    act(() => {
      void result.current.detect()
    })
    expect(seenSignal?.aborted).toBe(false)
    rerender({ audio: { sampleRate: 4, channels: [[0.5]] } })
    expect(seenSignal?.aborted).toBe(true)
  })

  it('aborts the previous run when a new detection starts', async () => {
    const signals: AbortSignal[] = []
    const pending: StructureDetector = {
      detect: (_audio, signal) => {
        if (signal) {
          signals.push(signal)
        }
        return new Promise(() => {})
      }
    }
    const { result } = renderHook(() =>
      useStructureDetection({
        loadedAudio: AUDIO,
        grid: NO_GRID,
        onSections: vi.fn(),
        detector: pending
      })
    )
    act(() => {
      void result.current.detect()
    })
    act(() => {
      void result.current.detect()
    })
    expect(signals[0]?.aborted).toBe(true)
    expect(signals[1]?.aborted).toBe(false)
  })

  it('does nothing without loaded audio', async () => {
    const detect = vi.fn()
    const { result } = renderHook(() =>
      useStructureDetection({
        loadedAudio: undefined,
        grid: NO_GRID,
        onSections: vi.fn(),
        detector: { detect }
      })
    )
    await act(() => result.current.detect())
    expect(detect).not.toHaveBeenCalled()
  })
})
