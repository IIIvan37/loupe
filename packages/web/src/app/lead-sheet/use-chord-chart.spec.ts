// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useChordChart } from './use-chord-chart.ts'

describe('useChordChart', () => {
  it('starts empty and untransposed', () => {
    const { result } = renderHook(() => useChordChart())
    expect(result.current.source).toBe('')
    expect(result.current.transposedBy).toBe(0)
  })

  it('keeps the offset across typing — an edit is not a key change', () => {
    const { result } = renderHook(() => useChordChart())
    act(() => result.current.setSource('| C |'))
    act(() => result.current.transpose(2))
    act(() => result.current.setSource('| D | Em |'))
    expect(result.current.transposedBy).toBe(2)
    expect(result.current.source).toBe('| D | Em |')
  })

  it('clearing the grid resets the offset — a rewrite starts a new key', () => {
    const { result } = renderHook(() => useChordChart())
    act(() => result.current.setSource('| C |'))
    act(() => result.current.transpose(2))
    act(() => result.current.setSource(''))
    expect(result.current.transposedBy).toBe(0)
    act(() => result.current.setSource('| Am |'))
    expect(result.current.transposedBy).toBe(0)
  })

  it('transposing a blank grid is a no-op — no invisible offset', () => {
    const { result } = renderHook(() => useChordChart())
    act(() => result.current.transpose(1))
    act(() => result.current.transpose(1))
    expect(result.current.transposedBy).toBe(0)
    act(() => result.current.setSource('| C |'))
    expect(result.current.transposedBy).toBe(0)
  })

  it('a non-integer transpose leaves text and offset untouched', () => {
    const { result } = renderHook(() => useChordChart())
    act(() => result.current.setSource('| C |'))
    act(() => result.current.transpose(1.5))
    expect(result.current.source).toBe('| C |')
    expect(result.current.transposedBy).toBe(0)
  })

  it('transpose rewrites the source and accumulates the offset', () => {
    const { result } = renderHook(() => useChordChart())
    act(() => result.current.setSource('| C | Am |'))
    act(() => result.current.transpose(1))
    expect(result.current.source).toBe('| C# | A#m |')
    expect(result.current.transposedBy).toBe(1)
    act(() => result.current.transpose(1))
    expect(result.current.source).toBe('| D | Bm |')
    expect(result.current.transposedBy).toBe(2)
    act(() => result.current.transpose(-3))
    expect(result.current.transposedBy).toBe(-1)
  })

  it('seatDraft replaces the text and resets the offset — a fresh detection is in the original key', () => {
    const { result } = renderHook(() => useChordChart())
    act(() => result.current.setSource('| C |'))
    act(() => result.current.transpose(2))
    act(() => result.current.seatDraft('| G | D |'))
    expect(result.current.source).toBe('| G | D |')
    expect(result.current.transposedBy).toBe(0)
  })

  it('restore seats the persisted source and offset together', () => {
    const { result } = renderHook(() => useChordChart())
    act(() => result.current.restore({ source: '| Bm |', transposedBy: 2 }))
    expect(result.current.source).toBe('| Bm |')
    expect(result.current.transposedBy).toBe(2)
  })

  it('restore reads an absent chart or a pre-offset manifest as untransposed', () => {
    const { result } = renderHook(() => useChordChart())
    act(() => result.current.setSource('| C |'))
    act(() => result.current.transpose(3))
    act(() => result.current.restore(undefined))
    expect(result.current.source).toBe('')
    expect(result.current.transposedBy).toBe(0)
    act(() => result.current.restore({ source: '| Am |' }))
    expect(result.current.source).toBe('| Am |')
    expect(result.current.transposedBy).toBe(0)
  })

  it('reset clears both the text and the offset', () => {
    const { result } = renderHook(() => useChordChart())
    act(() => result.current.setSource('| C |'))
    act(() => result.current.transpose(1))
    act(() => result.current.reset())
    expect(result.current.source).toBe('')
    expect(result.current.transposedBy).toBe(0)
  })
})
