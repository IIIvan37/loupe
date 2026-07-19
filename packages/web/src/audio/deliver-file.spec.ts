// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { deliverFile } from './deliver-file.ts'

const invoke = vi.fn()
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invoke(...args)
}))

function stubTauriShell(): () => void {
  ;(window as { __TAURI_INTERNALS__?: object }).__TAURI_INTERNALS__ = {}
  return () => {
    delete (window as { __TAURI_INTERNALS__?: object }).__TAURI_INTERNALS__
  }
}

describe('deliverFile', () => {
  beforeEach(() => {
    invoke.mockReset()
    URL.createObjectURL = vi.fn(() => 'blob:test')
    URL.revokeObjectURL = vi.fn()
  })

  it('delivers through the anchor download outside the desktop shell', async () => {
    const clicks: string[] = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement
    ) {
      clicks.push(this.download)
    })
    const delivered = await deliverFile(
      'piste.wav',
      new Blob([new Uint8Array([1])])
    )
    expect(delivered).toBe(true)
    expect(clicks).toEqual(['piste.wav'])
    expect(invoke).not.toHaveBeenCalled()
  })

  it('picks the path first, then streams the bytes under the token', async () => {
    const restore = stubTauriShell()
    try {
      invoke.mockResolvedValueOnce('7').mockResolvedValueOnce(undefined)
      const delivered = await deliverFile(
        'métronome.wav',
        new Blob([new Uint8Array([1, 2, 3])])
      )
      expect(delivered).toBe(true)
      expect(invoke.mock.calls[0]).toEqual([
        'pick_export_path',
        { name: 'métronome.wav' }
      ])
      const [command, payload, options] = invoke.mock.calls[1] as [
        string,
        Uint8Array,
        { headers: Record<string, string> }
      ]
      expect(command).toBe('write_export')
      expect([...payload]).toEqual([1, 2, 3])
      expect(options.headers['x-export-token']).toBe('7')
    } finally {
      restore()
    }
  })

  it('reports a cancelled save dialog as not delivered and sends nothing', async () => {
    const restore = stubTauriShell()
    try {
      invoke.mockResolvedValue(null)
      const delivered = await deliverFile(
        'a.zip',
        new Blob([new Uint8Array([1])])
      )
      expect(delivered).toBe(false)
      expect(invoke).toHaveBeenCalledTimes(1)
    } finally {
      restore()
    }
  })

  it('reports a failed write as not delivered instead of throwing', async () => {
    const restore = stubTauriShell()
    try {
      invoke
        .mockResolvedValueOnce('9')
        .mockRejectedValueOnce(new Error('disk full'))
      const delivered = await deliverFile(
        'a.zip',
        new Blob([new Uint8Array([1])])
      )
      expect(delivered).toBe(false)
    } finally {
      restore()
    }
  })
})
