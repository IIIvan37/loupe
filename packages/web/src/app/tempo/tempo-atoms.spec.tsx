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
