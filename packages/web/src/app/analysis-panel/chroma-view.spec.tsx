// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import type { SpectrumFrame } from '@app/core'
import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '../../i18n/i18n.ts'
import { I18nTestingProvider } from '../../i18n/i18n-testing-provider.tsx'
import { ChromaView } from './chroma-view.tsx'

/** A 2048-bin frame with one magnitude-1 peak at 440 Hz (pitch class A). */
function frameAt440(): SpectrumFrame {
  const magnitudes = new Float32Array(2048)
  magnitudes[Math.round((440 * 2 * 2048) / 44100)] = 1
  return { magnitudes, sampleRate: 44100 }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('ChromaView', () => {
  it('invites the user to play while the transport is idle', () => {
    render(<ChromaView readSpectrum={() => undefined} playing={false} />, {
      wrapper: I18nTestingProvider
    })
    expect(
      screen.getByText(i18n._('analysis.chroma-idle'))
    ).toBeInTheDocument()
  })

  it('raises the bar of the playing note to full height', () => {
    render(<ChromaView readSpectrum={frameAt440} playing />, {
      wrapper: I18nTestingProvider
    })
    act(() => {
      vi.advanceTimersByTime(150)
    })
    const bar = screen.getByTestId('chroma-bar-A')
    expect(bar.style.blockSize).toBe('100%')
  })

  it('names the twelve pitch classes', () => {
    render(<ChromaView readSpectrum={frameAt440} playing />, {
      wrapper: I18nTestingProvider
    })
    act(() => {
      vi.advanceTimersByTime(150)
    })
    expect(screen.getByText('F♯')).toBeInTheDocument()
  })

  it('stops polling once playback pauses', () => {
    const readSpectrum = vi.fn(frameAt440)
    const { rerender } = render(
      <ChromaView readSpectrum={readSpectrum} playing />,
      { wrapper: I18nTestingProvider }
    )
    act(() => {
      vi.advanceTimersByTime(150)
    })
    const polled = readSpectrum.mock.calls.length
    rerender(<ChromaView readSpectrum={readSpectrum} playing={false} />)
    act(() => {
      vi.advanceTimersByTime(500)
    })
    expect(readSpectrum.mock.calls.length).toBe(polled)
  })
})
