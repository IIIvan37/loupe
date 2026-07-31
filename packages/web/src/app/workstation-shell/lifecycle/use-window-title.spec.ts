// @vitest-environment jsdom
import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useWindowTitle } from './use-window-title.ts'

describe('useWindowTitle', () => {
  beforeEach(() => {
    // A sentinel, NOT the expected fallback: the fallback test must prove
    // the hook writes the base title, not inherit it from the environment.
    document.title = 'stale title from a previous state'
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
})
