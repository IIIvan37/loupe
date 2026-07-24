// @vitest-environment jsdom
import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useWindowTitle } from './use-window-title.ts'

const setTitle = vi.fn(async (_title: string) => undefined)
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({ setTitle })
}))

function stubTauriShell(): () => void {
  ;(window as { __TAURI_INTERNALS__?: object }).__TAURI_INTERNALS__ = {}
  return () => {
    delete (window as { __TAURI_INTERNALS__?: object }).__TAURI_INTERNALS__
  }
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('useWindowTitle', () => {
  beforeEach(() => {
    setTitle.mockClear()
    document.title = 'Loupe — poste de travail de transcription'
  })

  it('titles the window after the loaded track', () => {
    renderHook(() => useWindowTitle('So What', false))
    expect(document.title).toBe('So What — Loupe')
  })

  it('marks unsaved work with the dirty dot', () => {
    renderHook(() => useWindowTitle('So What', true))
    expect(document.title).toBe('● So What — Loupe')
  })

  it('falls back to the app title with no track', () => {
    renderHook(() => useWindowTitle(undefined, false))
    expect(document.title).toBe('Loupe — poste de travail de transcription')
  })

  it('mirrors the title onto the native window under the Tauri shell', async () => {
    const restore = stubTauriShell()
    try {
      renderHook(() => useWindowTitle('So What', true))
      await flush()
      expect(setTitle).toHaveBeenCalledWith('● So What — Loupe')
    } finally {
      restore()
    }
  })

  it('leaves the native window alone outside the shell', async () => {
    renderHook(() => useWindowTitle('So What', false))
    await flush()
    expect(setTitle).not.toHaveBeenCalled()
  })
})
