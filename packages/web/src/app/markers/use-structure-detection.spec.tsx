// @vitest-environment jsdom
import {
  type BeatGrid,
  type DecodedAudio,
  type DetectedSection,
  StructureDetectionError,
  type StructureDetector
} from '@app/core'
import { act, renderHook } from '@testing-library/react'
import { Provider, createStore } from 'jotai'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadedAudioAtom } from '../track/track-atoms.ts'
import { useStructureDetection } from './use-structure-detection.ts'

// The analysis gate only engages on the offload path (VITE_ANALYSIS_URL set).
// A developer's .env.local may set it, so pin it OFF for the default cases —
// their synchronous detector semantics assume the token-less local path. The
// two gate cases opt back in.
beforeEach(() => vi.stubEnv('VITE_ANALYSIS_URL', ''))
afterEach(() => vi.unstubAllEnvs())

const AUDIO: DecodedAudio = { sampleRate: 4, channels: [[0, 1, -1, 0.5]] }

/** A store with the track loaded — the hook reads the PCM off the player's
 * atom (ADR 0010); `undefined` mounts it before any import (no default: an
 * explicit `undefined` would fall back to it). Replacing the
 * atom's value is how a test replaces the track. */
function loadedStore(audio: DecodedAudio | undefined) {
  const store = createStore()
  store.set(loadedAudioAtom, audio)
  const wrapper = ({ children }: { readonly children: ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  )
  return { store, wrapper }
}

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
  it('mounts without the analysis endpoint configured', () => {
    // The endpoint is mandatory for a RUN, not for a mount — see
    // `use-separation.spec`.
    vi.stubEnv('VITE_ANALYSIS_URL', '')
    expect(() =>
      renderHook(
        () => useStructureDetection({ grid: NO_GRID, onSections: vi.fn() }),
        { wrapper: loadedStore(AUDIO).wrapper }
      )
    ).not.toThrow()
  })

  it('hands the detected sections to onSections', async () => {
    const sections: DetectedSection[] = [
      { startSeconds: 0, endSeconds: 12, label: 'intro' },
      { startSeconds: 12, endSeconds: 40, label: 'verse' }
    ]
    const onSections = vi.fn()
    const { result } = renderHook(() =>
      useStructureDetection({
        grid: NO_GRID,
        onSections,
        detector: detectorOf(sections)
      }),
      { wrapper: loadedStore(AUDIO).wrapper }
    )
    await act(() => result.current.detect())
    expect(onSections).toHaveBeenCalledWith(sections)
    expect(result.current.succeeded).toBe(true)
  })

  it('reports the busy state while a detection is in flight', async () => {
    const detector = gatedDetector()
    const { result } = renderHook(() =>
      useStructureDetection({
        grid: NO_GRID,
        onSections: vi.fn(),
        detector
      }),
      { wrapper: loadedStore(AUDIO).wrapper }
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
    // The failure path logs its raw detail (asserted in its own test below) —
    // muted here so the suite output stays signal.
    const muted = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { result } = renderHook(() =>
      useStructureDetection({
        grid: NO_GRID,
        onSections: vi.fn(),
        detector: detectorOf([])
      }),
      { wrapper: loadedStore(AUDIO).wrapper }
    )
    await act(() => result.current.detect())
    expect(result.current.error).toBe('no-structure')
    muted.mockRestore()
  })

  it('surfaces a failed detection as an error code, clearing on the next run', async () => {
    const muted = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const boom: StructureDetector = {
      detect: async () => {
        throw new Error('structure engine down')
      }
    }
    const onSections = vi.fn()
    const { result, rerender } = renderHook(
      ({ detector }: { detector: StructureDetector }) =>
        useStructureDetection({
          grid: NO_GRID,
          onSections,
          detector
        }),
      { wrapper: loadedStore(AUDIO).wrapper, initialProps: { detector: boom } }
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
    muted.mockRestore()
  })

  it('surfaces the typed code a StructureDetectionError carries', async () => {
    const muted = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const engineDown: StructureDetector = {
      detect: async () => {
        throw new StructureDetectionError('engine-unavailable', 'HTTP 503')
      }
    }
    const { result } = renderHook(() =>
      useStructureDetection({
        grid: NO_GRID,
        onSections: vi.fn(),
        detector: engineDown
      }),
      { wrapper: loadedStore(AUDIO).wrapper }
    )
    await act(() => result.current.detect())
    expect(result.current.error).toBe('engine-unavailable')
    muted.mockRestore()
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
        grid: NO_GRID,
        onSections: vi.fn(),
        detector: engineDown
      }),
      { wrapper: loadedStore(AUDIO).wrapper }
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
    const { store, wrapper } = loadedStore(AUDIO)
    const { result } = renderHook(
      () =>
        useStructureDetection({
          grid: NO_GRID,
          onSections,
          detector
        }),
      { wrapper }
    )
    let run: Promise<void> = Promise.resolve()
    act(() => {
      run = result.current.detect()
    })
    act(() => store.set(loadedAudioAtom, { sampleRate: 4, channels: [[0.5]] }))
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
    const { store, wrapper } = loadedStore(AUDIO)
    const { result } = renderHook(
      () =>
        useStructureDetection({
          grid: NO_GRID,
          onSections: vi.fn(),
          detector: pending
        }),
      { wrapper }
    )
    // Imperative hook API with no user event — act wraps the sync state flip.
    act(() => {
      void result.current.detect()
    })
    expect(seenSignal?.aborted).toBe(false)
    act(() => store.set(loadedAudioAtom, { sampleRate: 4, channels: [[0.5]] }))
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
        grid: NO_GRID,
        onSections: vi.fn(),
        detector: pending
      }),
      { wrapper: loadedStore(AUDIO).wrapper }
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
        grid: NO_GRID,
        onSections: vi.fn(),
        detector: { detect }
      }),
      { wrapper: loadedStore(undefined).wrapper }
    )
    await act(() => result.current.detect())
    expect(detect).not.toHaveBeenCalled()
  })

  it('raises the busy face before the gate mint resolves (R.3)', async () => {
    vi.stubEnv('VITE_ANALYSIS_URL', 'https://modal.example')
    let open: (result: { ok: false; reason: 'sign-in-required' }) => void =
      () => {}
    const gatePromise = new Promise<{ ok: false; reason: 'sign-in-required' }>(
      (resolve) => {
        open = resolve
      }
    )
    const { result } = renderHook(() =>
      useStructureDetection({
        grid: NO_GRID,
        onSections: vi.fn(),
        detector: { detect: vi.fn(async () => []) },
        gate: () => gatePromise
      }),
      { wrapper: loadedStore(AUDIO).wrapper }
    )
    let run: Promise<void> = Promise.resolve()
    act(() => {
      run = result.current.detect()
    })
    // The whole wait since the click is narrated — mint round-trip included.
    expect(result.current.detecting).toBe(true)
    act(() => open({ ok: false, reason: 'sign-in-required' }))
    await act(() => run)
    expect(result.current.detecting).toBe(false)
  })

  it('a cancel during the mint stops the superseded run', async () => {
    vi.stubEnv('VITE_ANALYSIS_URL', 'https://modal.example')
    let open: (result: { ok: true }) => void = () => {}
    const gatePromise = new Promise<{ ok: true }>((resolve) => {
      open = resolve
    })
    const detect = vi.fn(async () => [])
    const { result } = renderHook(() =>
      useStructureDetection({
        grid: NO_GRID,
        onSections: vi.fn(),
        detector: { detect },
        gate: () => gatePromise
      }),
      { wrapper: loadedStore(AUDIO).wrapper }
    )
    let run: Promise<void> = Promise.resolve()
    act(() => {
      run = result.current.detect()
    })
    act(() => result.current.cancel())
    expect(result.current.detecting).toBe(false)
    // The gate resolving OK afterwards must not start the detector anyway.
    act(() => open({ ok: true }))
    await act(() => run)
    expect(detect).not.toHaveBeenCalled()
    expect(result.current.detecting).toBe(false)
  })

  it('lets the newer of two overlapping detections win', async () => {
    // Both gestures capture their token before the mint, so whichever gate
    // resolves first must not lock the other out: the newest gesture carries
    // the track the user last asked about, and « newest wins » is the
    // invariant every comment in these hooks asserts. Told apart by the audio
    // each gesture captured — the older one also spends a metered analysis on
    // a track that is no longer loaded.
    vi.stubEnv('VITE_ANALYSIS_URL', 'https://modal.example')
    const later: DecodedAudio = { sampleRate: 4, channels: [[0.5]] }
    const opens: ((result: { ok: true }) => void)[] = []
    const seen: DecodedAudio[] = []
    const detector = {
      detect: async (audio: DecodedAudio) => {
        seen.push(audio)
        return []
      }
    }
    const { store, wrapper } = loadedStore(AUDIO)
    const { result } = renderHook(
      () =>
        useStructureDetection({
          grid: NO_GRID,
          onSections: vi.fn(),
          detector,
          gate: () =>
            new Promise<{ ok: true }>((resolve) => {
              opens.push(resolve)
            })
        }),
      { wrapper }
    )
    let first: Promise<void> = Promise.resolve()
    let second: Promise<void> = Promise.resolve()
    act(() => {
      first = result.current.detect()
    })
    act(() => store.set(loadedAudioAtom, later))
    act(() => {
      second = result.current.detect()
    })
    act(() => opens[0]?.({ ok: true }))
    await act(() => first)
    act(() => opens[1]?.({ ok: true }))
    await act(() => second)

    expect(seen).toEqual([later])
  })

  it('blocks the analysis and surfaces the reason when the gate fails', async () => {
    // The gate only runs on the offload path; stub it on for these two tests.
    vi.stubEnv('VITE_ANALYSIS_URL', 'https://modal.example')
    const detect = vi.fn(async () => [])
    const { result } = renderHook(() =>
      useStructureDetection({
        grid: NO_GRID,
        onSections: vi.fn(),
        detector: { detect },
        gate: async () => ({ ok: false, reason: 'quota-exceeded' })
      }),
      { wrapper: loadedStore(AUDIO).wrapper }
    )
    await act(() => result.current.detect())
    // The core detector never ran — the gate stopped it — and the reason is out.
    expect(detect).not.toHaveBeenCalled()
    expect(result.current.gateReason).toBe('quota-exceeded')
    expect(result.current.detecting).toBe(false)
    expect(result.current.error).toBeUndefined()
  })

  it('runs and clears any prior gate reason once the gate passes', async () => {
    vi.stubEnv('VITE_ANALYSIS_URL', 'https://modal.example')
    const onSections = vi.fn()
    const gate = vi
      .fn<
        () => Promise<{ ok: true } | { ok: false; reason: 'sign-in-required' }>
      >()
      .mockResolvedValueOnce({ ok: false, reason: 'sign-in-required' })
      .mockResolvedValue({ ok: true })
    const { result } = renderHook(() =>
      useStructureDetection({
        grid: NO_GRID,
        onSections,
        detector: detectorOf([
          { startSeconds: 0, endSeconds: 12, label: 'intro' }
        ]),
        gate
      }),
      { wrapper: loadedStore(AUDIO).wrapper }
    )
    await act(() => result.current.detect())
    expect(result.current.gateReason).toBe('sign-in-required')

    await act(() => result.current.detect())
    expect(result.current.gateReason).toBeUndefined()
    expect(onSections).toHaveBeenCalledOnce()
  })
})
