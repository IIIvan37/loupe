// @vitest-environment jsdom
import type { DecodedAudio, StemSeparator } from '@app/core'
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
