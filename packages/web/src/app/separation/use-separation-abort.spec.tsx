// @vitest-environment jsdom
// M1.3 repro: cancel must abort the REAL http separator's transfer end-to-end
// (O.5). Wires useSeparation to createHttpSeparator over a fake fetch.
import type { DecodedAudio } from '@app/core'
import { act, renderHook } from '@testing-library/react'
import { vi } from 'vitest'
import { createHttpSeparator } from '../../audio/http-separator.ts'
import { I18nTestingProvider } from '../../i18n/i18n-testing-provider.tsx'
import { useSeparation } from './use-separation.ts'

const audio: DecodedAudio = { sampleRate: 4, channels: [[0, 1, -1, 0.5]] }

describe('useSeparation × createHttpSeparator — abort end-to-end (O.5)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('cancel during a slow gate mint never starts the transfer', async () => {
    vi.stubEnv('VITE_STRUCTURE_URL', 'https://modal.example')
    const fetchMock = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetchMock)
    let mint: (r: { ok: true }) => void = () => {}
    const gate = () => new Promise<{ ok: true }>((r) => { mint = r })
    const separator = createHttpSeparator('https://modal.example', async () => 'jwt')
    const { result } = renderHook(
      () => useSeparation(() => undefined, separator, undefined, gate),
      { wrapper: I18nTestingProvider }
    )
    let run: Promise<unknown> = Promise.resolve()
    act(() => { run = result.current.separate(audio) })
    act(() => result.current.cancel())
    act(() => mint({ ok: true }))
    await act(() => run)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('cancel mid-transfer aborts the fetch signal', async () => {
    vi.stubEnv('VITE_STRUCTURE_URL', 'https://modal.example')
    let seen: AbortSignal | undefined
    const fetchMock = vi.fn<typeof fetch>((_url, init) => {
      seen = (init?.signal ?? undefined) as AbortSignal | undefined
      return new Promise<Response>((_resolve, reject) => {
        seen?.addEventListener('abort', () =>
          reject(new DOMException('Aborted', 'AbortError'))
        )
      })
    })
    vi.stubGlobal('fetch', fetchMock)
    const separator = createHttpSeparator('https://modal.example', async () => 'jwt')
    const { result } = renderHook(
      () => useSeparation(() => undefined, separator, undefined, async () => ({ ok: true })),
      { wrapper: I18nTestingProvider }
    )
    let run: Promise<unknown> = Promise.resolve()
    act(() => { run = result.current.separate(audio) })
    // Let the gate microtask + token read resolve so the fetch is in flight.
    await act(async () => {})
    expect(fetchMock).toHaveBeenCalled()
    act(() => result.current.cancel())
    expect(seen?.aborted).toBe(true)
    await act(() => run)
    expect(result.current.state.status).toBe('idle')
  })
})
