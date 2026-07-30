// @vitest-environment jsdom
import type { TempoAnalysis, TempoDetector } from '@app/core'
import { act, renderHook } from '@testing-library/react'
import { Provider, createStore, useAtomValue } from 'jotai'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { tempoAnalysisAtom, tempoGateReasonAtom } from './tempo-atoms.ts'
import { useTempo } from './use-tempo.ts'

// Same env pin as use-tempo.spec: the gate only engages on the offload path.
beforeEach(() => vi.stubEnv('VITE_ANALYSIS_URL', ''))
afterEach(() => vi.unstubAllEnvs())

const analysis: TempoAnalysis = { bpm: 120, grid: [], beatsPerBar: 4 }

/**
 * The tempo hook and a foreign consumer of one of its atoms, in two separate
 * trees sharing ONE store — the shape the shell reaches once the feature owns
 * its state (ADR 0010): nothing passes between them but the atom.
 */
function mountTempoAndConsumer(
  atom: typeof tempoAnalysisAtom | typeof tempoGateReasonAtom,
  detector: TempoDetector,
  gate?: () => Promise<{ ok: false; reason: 'sign-in-required' }>
) {
  const store = createStore()
  const wrapper = ({ children }: { readonly children: ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  )
  const tempo = renderHook(() => useTempo(detector, gate), { wrapper })
  const consumer = renderHook(() => useAtomValue(atom), { wrapper })
  return { tempo, consumer }
}

describe('tempoAnalysisAtom', () => {
  it('tells a foreign consumer the seated analysis, with no prop threaded', () => {
    const { tempo, consumer } = mountTempoAndConsumer(
      tempoAnalysisAtom,
      { detect: vi.fn() }
    )

    act(() => tempo.result.current.set(analysis))

    expect(consumer.result.current).toBe(analysis)
  })

  it('falls back to undefined once the tempo is reset', () => {
    const { tempo, consumer } = mountTempoAndConsumer(
      tempoAnalysisAtom,
      { detect: vi.fn() }
    )
    act(() => tempo.result.current.set(analysis))

    act(() => tempo.result.current.reset())

    expect(consumer.result.current).toBeUndefined()
  })
})

/**
 * Two `useTempo` consumers under ONE store — the shape the regions reach when
 * they read the hook themselves (ADR 0010): the whole bag is session state,
 * including the run token, so a cancel or a seat from one instance supersedes
 * a detection started by another.
 */
function mountTwoTempos(
  detector: TempoDetector,
  second: TempoDetector = { detect: vi.fn() }
) {
  const store = createStore()
  const wrapper = ({ children }: { readonly children: ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  )
  const a = renderHook(() => useTempo(detector), { wrapper })
  const b = renderHook(() => useTempo(second), { wrapper })
  return { a, b }
}

describe('useTempo across two consumers (one store)', () => {
  it('shares the busy flag: a run started by one is seen by the other', () => {
    const pending: TempoDetector = { detect: () => new Promise(() => {}) }
    const { a, b } = mountTwoTempos(pending)

    act(() => {
      void a.result.current.detect({ sampleRate: 4, channels: [[0, 1]] })
    })

    expect(b.result.current.detecting).toBe(true)
  })

  it('shares the octave shift and the manual override', () => {
    const { a, b } = mountTwoTempos({ detect: vi.fn() })

    act(() => {
      a.result.current.overrideBpm(100, 3)
    })
    act(() => {
      b.result.current.fold(0.5)
    })

    expect(a.result.current.analysis?.bpm).toBe(50)
    expect(a.result.current.octaveShift).toBe(-1)
    expect(a.result.current.manual?.bpm).toBe(50)
    expect(b.result.current.manual?.bpm).toBe(50)
  })

  it('a cancel from another consumer aborts the in-flight run', () => {
    // The analyser row cancels through ITS instance the detection the shell
    // started — the abort must reach the shared run, not a private ref.
    let seenSignal: AbortSignal | undefined
    const pending: TempoDetector = {
      detect: (_audio, signal) => {
        seenSignal = signal
        return new Promise(() => {})
      }
    }
    const { a, b } = mountTwoTempos(pending)
    act(() => {
      void a.result.current.detect({ sampleRate: 4, channels: [[0, 1]] })
    })

    act(() => b.result.current.cancelDetection())

    expect(seenSignal?.aborted).toBe(true)
    expect(a.result.current.detecting).toBe(false)
    expect(a.result.current.cancelled).toBe(true)
  })

  it('a seat from another consumer supersedes the in-flight detect', async () => {
    // A project open seats its persisted analysis while an auto-detect is in
    // flight — the late result must lose, whichever instance started the run.
    let release: (() => void) | undefined
    const gated: TempoDetector = {
      detect: () =>
        new Promise((resolve) => {
          release = () =>
            resolve({ bpm: 90, beats: [{ timeSeconds: 0, barPosition: 1 }] })
        })
    }
    const { a, b } = mountTwoTempos(gated)
    let pending: Promise<unknown> | undefined
    act(() => {
      pending = a.result.current.detect({ sampleRate: 4, channels: [[0, 1]] })
    })

    act(() => b.result.current.set(analysis))
    await act(async () => {
      release?.()
      await pending
    })

    expect(a.result.current.analysis).toBe(analysis)
    expect(a.result.current.detecting).toBe(false)
  })

  it('shares the error and its clearing across consumers', async () => {
    const boom: TempoDetector = {
      detect: async () => {
        throw new Error('server down')
      }
    }
    const { a, b } = mountTwoTempos(boom)
    await act(async () => {
      await a.result.current.detect({ sampleRate: 4, channels: [[0, 1]] })
    })
    expect(b.result.current.error).toBe('unknown')

    act(() => b.result.current.reset())

    expect(a.result.current.error).toBeUndefined()
  })
})

describe('tempoGateReasonAtom', () => {
  it('tells a foreign consumer why a run was gate-blocked, no prop', async () => {
    vi.stubEnv('VITE_ANALYSIS_URL', 'https://modal.example')
    const { tempo, consumer } = mountTempoAndConsumer(
      tempoGateReasonAtom,
      { detect: vi.fn() },
      async () => ({ ok: false, reason: 'sign-in-required' })
    )

    await act(async () => {
      await tempo.result.current.detect({
        sampleRate: 4,
        channels: [[0, 1, -1, 0.5]]
      })
    })

    expect(consumer.result.current).toBe('sign-in-required')
  })
})
