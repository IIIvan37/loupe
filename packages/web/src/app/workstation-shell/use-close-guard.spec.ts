// @vitest-environment jsdom
import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCloseGuard } from './use-close-guard.ts'

type Handler = (event: { payload: unknown }) => void
let handler: Handler | undefined
const unlisten = vi.fn()
const listen = vi.fn(async (_event: string, callback: Handler) => {
  handler = callback
  return unlisten
})
const invoke = vi.fn(async (_command: string) => undefined)
vi.mock('@tauri-apps/api/event', () => ({
  listen: (event: string, callback: Handler) => listen(event, callback)
}))
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (command: string) => invoke(command)
}))

function stubTauriShell(): () => void {
  ;(window as { __TAURI_INTERNALS__?: object }).__TAURI_INTERNALS__ = {}
  return () => {
    delete (window as { __TAURI_INTERNALS__?: object }).__TAURI_INTERNALS__
  }
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('useCloseGuard', () => {
  beforeEach(() => {
    handler = undefined
    listen.mockClear()
    unlisten.mockClear()
    invoke.mockClear()
  })

  it('stays inert outside the desktop shell', () => {
    renderHook(() => useCloseGuard(true, vi.fn()))
    expect(listen).not.toHaveBeenCalled()
  })

  it('lets a clean session close immediately', async () => {
    const restore = stubTauriShell()
    try {
      renderHook(() => useCloseGuard(false, vi.fn()))
      await flush()
      handler?.({ payload: undefined })
      await flush()
      expect(invoke).toHaveBeenCalledWith('confirm_close')
    } finally {
      restore()
    }
  })

  it('holds a dirty session and asks instead of closing', async () => {
    const restore = stubTauriShell()
    try {
      const onConfirmNeeded = vi.fn()
      renderHook(() => useCloseGuard(true, onConfirmNeeded))
      await flush()
      handler?.({ payload: undefined })
      await flush()
      expect(onConfirmNeeded).toHaveBeenCalledTimes(1)
      expect(invoke).not.toHaveBeenCalledWith('confirm_close')
    } finally {
      restore()
    }
  })

  it('reads the dirty flag at close time, not at subscribe time', async () => {
    const restore = stubTauriShell()
    try {
      const onConfirmNeeded = vi.fn()
      const hook = renderHook(
        ({ dirty }) => useCloseGuard(dirty, onConfirmNeeded),
        { initialProps: { dirty: true } }
      )
      await flush()
      hook.rerender({ dirty: false })
      handler?.({ payload: undefined })
      await flush()
      expect(invoke).toHaveBeenCalledWith('confirm_close')
    } finally {
      restore()
    }
  })

  it('arms the shell guard once subscribed — before that, exits pass free', async () => {
    const restore = stubTauriShell()
    try {
      renderHook(() => useCloseGuard(true, vi.fn()))
      await flush()
      expect(invoke).toHaveBeenCalledWith('arm_close_guard')
    } finally {
      restore()
    }
  })

  it('unsubscribes on unmount', async () => {
    const restore = stubTauriShell()
    try {
      const hook = renderHook(() => useCloseGuard(false, vi.fn()))
      await flush()
      hook.unmount()
      expect(unlisten).toHaveBeenCalledTimes(1)
    } finally {
      restore()
    }
  })
})
