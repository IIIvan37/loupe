// @vitest-environment jsdom
import type { DecodedAudio, SeparatedStem, StemSeparator } from '@app/core'
import { act, renderHook } from '@testing-library/react'
import { Provider, createStore, useAtomValue } from 'jotai'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nTestingProvider } from '../../i18n/i18n-testing-provider.tsx'
import { separationGateReasonAtom } from './separation-atoms.ts'
import { useSeparation } from './use-separation.ts'

// The gate only engages on the offload path — same env pin as use-separation.spec.
beforeEach(() => vi.stubEnv('VITE_ANALYSIS_URL', 'https://modal.example'))
afterEach(() => vi.unstubAllEnvs())

const audio: DecodedAudio = { sampleRate: 4, channels: [[0, 1, -1, 0.5]] }

/**
 * The separation hook and a foreign consumer of its gate atom, in two separate
 * trees sharing ONE store — the shape the shell reaches once the feature owns
 * its state (ADR 0010): nothing passes between them but the atom.
 */
function mountSeparationAndConsumer(
  separator: StemSeparator,
  gate: () => Promise<
    { ok: true } | { ok: false; reason: 'sign-in-required' }
  >
) {
  const store = createStore()
  const wrapper = ({ children }: { readonly children: ReactNode }) => (
    <I18nTestingProvider>
      <Provider store={store}>{children}</Provider>
    </I18nTestingProvider>
  )
  const separation = renderHook(
    () => useSeparation(() => undefined, separator, undefined, gate),
    { wrapper }
  )
  const consumer = renderHook(() => useAtomValue(separationGateReasonAtom), {
    wrapper
  })
  return { separation, consumer }
}

/**
 * Two `useSeparation` consumers under ONE store — the shape the regions reach
 * when they read the hook themselves (ADR 0010): the whole bag is session
 * state, including the run token, so a cancel from one instance aborts a
 * separation started by another.
 */
function mountTwoSeparations(separator: StemSeparator) {
  const store = createStore()
  const wrapper = ({ children }: { readonly children: ReactNode }) => (
    <I18nTestingProvider>
      <Provider store={store}>{children}</Provider>
    </I18nTestingProvider>
  )
  const gate = async () => ({ ok: true }) as const
  const a = renderHook(
    () => useSeparation(() => undefined, separator, undefined, gate),
    { wrapper }
  )
  const b = renderHook(
    () => useSeparation(() => undefined, separator, undefined, gate),
    { wrapper }
  )
  return { a, b }
}

describe('useSeparation across two consumers (one store)', () => {
  it('shares the busy state: a run started by one is seen by the other', async () => {
    const pending: StemSeparator = { separate: () => new Promise(() => {}) }
    const { a, b } = mountTwoSeparations(pending)

    // Async act: the busy dispatch lands on a microtask (separate awaits the
    // gate first) — the async form flushes it before the assertion.
    await act(async () => {
      void a.result.current.separate(audio)
    })

    expect(b.result.current.state.status).toBe('analysing')
  })

  it('a cancel from another consumer aborts the in-flight run', async () => {
    // The analyser row cancels through ITS instance the separation the shell
    // started — the abort must reach the shared run, not a private ref.
    let seenSignal: AbortSignal | undefined
    const pending: StemSeparator = {
      separate: (_audio, _onProgress, signal) => {
        seenSignal = signal
        return new Promise(() => {})
      }
    }
    const { a, b } = mountTwoSeparations(pending)
    act(() => {
      void a.result.current.separate(audio)
    })
    // Let the gate microtask resolve so the separator holds the run's signal.
    await act(async () => {})
    expect(seenSignal?.aborted).toBe(false)

    act(() => b.result.current.cancel())

    expect(seenSignal?.aborted).toBe(true)
    expect(a.result.current.state.status).toBe('idle')
  })

  it('shares the committed stems once a run resolves', async () => {
    const stems: SeparatedStem[] = [{ id: 'voix', label: 'Voix', audio }]
    const { a, b } = mountTwoSeparations({ separate: async () => stems })

    await act(async () => {
      await a.result.current.separate(audio)
    })

    expect(b.result.current.state.status).toBe('ready')
    expect(b.result.current.state.stems.map((stem) => stem.id)).toEqual([
      'voix'
    ])
  })
})

describe('separationGateReasonAtom', () => {
  it('tells a foreign consumer why a run was gate-blocked, no prop', async () => {
    const { separation, consumer } = mountSeparationAndConsumer(
      { separate: vi.fn() },
      async () => ({ ok: false, reason: 'sign-in-required' })
    )

    await act(async () => {
      await separation.result.current.separate(audio)
    })

    expect(consumer.result.current).toBe('sign-in-required')
  })

  it('falls back to undefined once the separation is reset', async () => {
    const { separation, consumer } = mountSeparationAndConsumer(
      { separate: vi.fn() },
      async () => ({ ok: false, reason: 'sign-in-required' })
    )
    await act(async () => {
      await separation.result.current.separate(audio)
    })

    act(() => separation.result.current.reset())

    expect(consumer.result.current).toBeUndefined()
  })
})
