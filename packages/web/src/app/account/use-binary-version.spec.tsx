// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useBinaryVersion } from './use-binary-version.ts'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('useBinaryVersion', () => {
  it('reads /version from the serving origin in the server shell', async () => {
    vi.stubEnv('VITE_SHELL', 'server')
    const fetchSpy = vi.fn(
      async () => new Response(JSON.stringify({ version: '0.1.0' }))
    )
    vi.stubGlobal('fetch', fetchSpy)

    const { result } = renderHook(() => useBinaryVersion())

    await waitFor(() => expect(result.current).toBe('0.1.0'))
    expect(fetchSpy).toHaveBeenCalledWith('/version', expect.anything())
  })

  it('stays unknown in the plain browser — there is no binary to ask', () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    const { result } = renderHook(() => useBinaryVersion())

    expect(result.current).toBeUndefined()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('stays unknown when the endpoint fails, without throwing', async () => {
    vi.stubEnv('VITE_SHELL', 'server')
    const fetchSpy = vi.fn(async () => {
      throw new Error('boom')
    })
    vi.stubGlobal('fetch', fetchSpy)

    const { result } = renderHook(() => useBinaryVersion())

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled())
    expect(result.current).toBeUndefined()
  })
})
