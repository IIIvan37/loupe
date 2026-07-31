// @vitest-environment jsdom
import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useNativeMenu } from './use-native-menu.ts'

type Handler = (event: { payload: string }) => void
let handler: Handler | undefined
const unlisten = vi.fn()
const listen = vi.fn(async (_event: string, callback: Handler) => {
  handler = callback
  return unlisten
})
vi.mock('@tauri-apps/api/event', () => ({
  listen: (event: string, callback: Handler) => listen(event, callback)
}))

function stubTauriShell(): () => void {
  ;(window as { __TAURI_INTERNALS__?: object }).__TAURI_INTERNALS__ = {}
  return () => {
    delete (window as { __TAURI_INTERNALS__?: object }).__TAURI_INTERNALS__
  }
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('useNativeMenu', () => {
  beforeEach(() => {
    handler = undefined
    listen.mockClear()
    unlisten.mockClear()
  })

  it('stays inert outside the desktop shell', () => {
    renderHook(() =>
      useNativeMenu({ import: vi.fn(), save: vi.fn(), shortcuts: vi.fn() })
    )
    expect(listen).not.toHaveBeenCalled()
  })

  it('routes menu item ids onto the matching actions', async () => {
    const restore = stubTauriShell()
    try {
      const actions = { import: vi.fn(), save: vi.fn(), shortcuts: vi.fn() }
      renderHook(() => useNativeMenu(actions))
      await flush()
      expect(listen).toHaveBeenCalledWith('menu', expect.any(Function))
      handler?.({ payload: 'import' })
      handler?.({ payload: 'save' })
      handler?.({ payload: 'shortcuts' })
      expect(actions.import).toHaveBeenCalledTimes(1)
      expect(actions.save).toHaveBeenCalledTimes(1)
      expect(actions.shortcuts).toHaveBeenCalledTimes(1)
    } finally {
      restore()
    }
  })

  it('ignores unknown ids and unsubscribes on unmount', async () => {
    const restore = stubTauriShell()
    try {
      const actions = { import: vi.fn(), save: vi.fn(), shortcuts: vi.fn() }
      const hook = renderHook(() => useNativeMenu(actions))
      await flush()
      handler?.({ payload: 'not-a-menu-id' })
      expect(actions.import).not.toHaveBeenCalled()
      hook.unmount()
      expect(unlisten).toHaveBeenCalledTimes(1)
    } finally {
      restore()
    }
  })
})
