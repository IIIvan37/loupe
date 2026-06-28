// @vitest-environment jsdom
import type { DecodedAudio, SeparatedStem, StemSeparator } from '@app/core'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useSeparation } from './use-separation.ts'

const audio: DecodedAudio = { sampleRate: 4, channels: [[0, 1, -1, 0.5]] }

/** A separator whose result resolves only when the test says so. */
function deferredSeparator(): {
  separator: StemSeparator
  finish: (stems: SeparatedStem[]) => void
} {
  let resolve: (stems: readonly SeparatedStem[]) => void = () => {}
  return {
    separator: {
      separate: () =>
        new Promise<readonly SeparatedStem[]>((r) => {
          resolve = r
        })
    },
    finish: (stems) => resolve(stems)
  }
}

const stems: SeparatedStem[] = [{ id: 'voix', label: 'Voix', audio }]

describe('useSeparation', () => {
  it('runs a separation to completion and exposes the stems', async () => {
    const { separator, finish } = deferredSeparator()
    const { result } = renderHook(() => useSeparation(separator))

    act(() => {
      void result.current.separate(audio)
    })
    expect(result.current.state.status).toBe('analysing')

    await act(async () => {
      finish(stems)
    })
    await waitFor(() => expect(result.current.state.status).toBe('ready'))
    expect(result.current.state.stems.map((s) => s.id)).toEqual(['voix'])
  })

  it('ignores a stale run that finishes after a reset', async () => {
    const { separator, finish } = deferredSeparator()
    const { result } = renderHook(() => useSeparation(separator))

    // Start a run, then reset (as a new import does) before it resolves.
    act(() => {
      void result.current.separate(audio)
    })
    act(() => {
      result.current.reset()
    })
    expect(result.current.state.status).toBe('idle')

    // The abandoned run now resolves — its result must not repopulate state.
    await act(async () => {
      finish(stems)
    })
    expect(result.current.state.status).toBe('idle')
    expect(result.current.state.stems).toEqual([])
  })
})
