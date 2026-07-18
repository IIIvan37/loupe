// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import type { SpectrumFrame } from '@app/core'
import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '../../i18n/i18n.ts'
import { I18nTestingProvider } from '../../i18n/i18n-testing-provider.tsx'
import { createExternalValue } from '../../lib/external-value.ts'
import { ChromaView } from './chroma-view.tsx'

/** A 2048-bin frame with one magnitude-1 peak at 440 Hz (pitch class A). */
function frameAt440(): SpectrumFrame {
  const magnitudes = new Float32Array(2048)
  magnitudes[Math.round((440 * 2 * 2048) / 44100)] = 1
  return { magnitudes, sampleRate: 44100 }
}

/** Same shape, peak at 523 Hz (pitch class C) — a different note. */
function frameAt523(): SpectrumFrame {
  const magnitudes = new Float32Array(2048)
  magnitudes[Math.round((523 * 2 * 2048) / 44100)] = 1
  return { magnitudes, sampleRate: 44100 }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('ChromaView', () => {
  it('invites the user to import while no signal exists at all', () => {
    render(
      <ChromaView
        readSpectrum={() => undefined}
        playing={false}
        position={createExternalValue(0)}
      />,
      { wrapper: I18nTestingProvider }
    )
    expect(
      screen.getByText(i18n._('analysis.chroma-idle'))
    ).toBeInTheDocument()
  })

  it('raises the bar of the playing note to full height', () => {
    render(
      <ChromaView
        readSpectrum={frameAt440}
        playing
        position={createExternalValue(0)}
      />,
      { wrapper: I18nTestingProvider }
    )
    act(() => {
      vi.advanceTimersByTime(150)
    })
    const bar = screen.getByTestId('chroma-bar-A')
    expect(bar.style.blockSize).toBe('100%')
  })

  it('names the twelve pitch classes', () => {
    render(
      <ChromaView
        readSpectrum={frameAt440}
        playing
        position={createExternalValue(0)}
      />,
      { wrapper: I18nTestingProvider }
    )
    act(() => {
      vi.advanceTimersByTime(150)
    })
    expect(screen.getByText('F♯')).toBeInTheDocument()
  })

  it('shows the notes at the playhead without any playback (paused track)', () => {
    render(
      <ChromaView
        readSpectrum={frameAt440}
        playing={false}
        position={createExternalValue(0)}
      />,
      { wrapper: I18nTestingProvider }
    )
    act(() => {
      vi.advanceTimersByTime(0)
    })
    expect(screen.getByTestId('chroma-bar-A').style.blockSize).toBe('100%')
  })

  it('follows paused navigation — a seek refreshes the read-out', () => {
    const position = createExternalValue(0)
    let frame = frameAt440()
    render(
      <ChromaView
        readSpectrum={() => frame}
        playing={false}
        position={position}
      />,
      { wrapper: I18nTestingProvider }
    )
    act(() => {
      vi.advanceTimersByTime(0)
    })
    expect(screen.getByTestId('chroma-bar-A').style.blockSize).toBe('100%')
    frame = frameAt523()
    act(() => {
      position.set(12.5)
    })
    expect(screen.getByTestId('chroma-bar-C').style.blockSize).toBe('100%')
    expect(screen.getByTestId('chroma-bar-A').style.blockSize).toBe('0%')
  })

  it('stops polling once playback pauses — only seeks refresh at rest', () => {
    const readSpectrum = vi.fn(frameAt440)
    const position = createExternalValue(0)
    const { rerender } = render(
      <ChromaView readSpectrum={readSpectrum} playing position={position} />,
      { wrapper: I18nTestingProvider }
    )
    act(() => {
      vi.advanceTimersByTime(150)
    })
    rerender(
      <ChromaView
        readSpectrum={readSpectrum}
        playing={false}
        position={position}
      />
    )
    // Pausing reads ONCE (the tap goes silent, the buffer takes over) …
    act(() => {
      vi.advanceTimersByTime(0)
    })
    const afterPause = readSpectrum.mock.calls.length
    act(() => {
      vi.advanceTimersByTime(500)
    })
    // … then the clock is quiet: no interval reads while at rest.
    expect(readSpectrum.mock.calls).toHaveLength(afterPause)
  })
})
