// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useDropImport } from './use-drop-import.ts'

function audioFile(name = 'take.wav'): File {
  return new File([new Uint8Array([1])], name, { type: 'audio/wav' })
}

describe('useDropImport', () => {
  it('imports immediately when there is no unsaved work', () => {
    const importFile = vi.fn()
    const { result } = renderHook(() => useDropImport(importFile, false))

    const file = audioFile()
    act(() => result.current.onDropFile(file))

    expect(importFile).toHaveBeenCalledWith(file)
    expect(result.current.pendingName).toBeUndefined()
  })

  it('holds the drop for confirmation while work is unsaved', () => {
    const importFile = vi.fn()
    const { result } = renderHook(() => useDropImport(importFile, true))

    act(() => result.current.onDropFile(audioFile('mix.mp3')))

    expect(importFile).not.toHaveBeenCalled()
    expect(result.current.pendingName).toBe('mix.mp3')
  })

  it('imports the held file on confirm and clears the prompt', () => {
    const importFile = vi.fn()
    const { result } = renderHook(() => useDropImport(importFile, true))
    const file = audioFile('mix.mp3')

    act(() => result.current.onDropFile(file))
    act(() => result.current.confirm())

    expect(importFile).toHaveBeenCalledWith(file)
    expect(result.current.pendingName).toBeUndefined()
  })

  it('discards the held file on cancel — no import', () => {
    const importFile = vi.fn()
    const { result } = renderHook(() => useDropImport(importFile, true))

    act(() => result.current.onDropFile(audioFile()))
    act(() => result.current.cancel())

    expect(importFile).not.toHaveBeenCalled()
    expect(result.current.pendingName).toBeUndefined()
  })
})
