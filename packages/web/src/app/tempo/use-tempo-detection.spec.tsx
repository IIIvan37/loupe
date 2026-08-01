// @vitest-environment jsdom
import type { DecodedAudio } from '@app/core'
import { act, renderHook, waitFor } from '@testing-library/react'
import { Provider, createStore } from 'jotai'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AudioSessionProvider } from '../audio-session/audio-session-provider.tsx'
import type { Mixer } from '../mixer/use-mixer.ts'
import { DEFAULT_METRONOME_CHANNEL } from './metronome-stem.ts'
import { tempoCancelledAtom } from './tempo-atoms.ts'
import { useTempoDetection } from './use-tempo-detection.ts'

// The analysis gate only engages on the offload path (VITE_ANALYSIS_URL set) —
// pin it OFF so the token-less local path drives the default cases.
beforeEach(() => vi.stubEnv('VITE_ANALYSIS_URL', ''))
afterEach(() => vi.unstubAllEnvs())

const AUDIO: DecodedAudio = { sampleRate: 4, channels: [[0, 1, -1, 0.5]] }

function fakeMixer(): Mixer {
  return {
    channels: [],
    state: [],
    load: vi.fn(),
    restore: vi.fn(),
    addStem: vi.fn(),
    removeStem: vi.fn(),
    replaceStem: vi.fn(),
    reset: vi.fn(),
    setGain: vi.fn(),
    toggleMute: vi.fn(),
    toggleSolo: vi.fn(),
    setFilter: vi.fn()
  }
}

/**
 * The hook derives tempo and metronome from their feature itself (ADR 0010):
 * nothing reaches it but the mixer seam and values. The detector is the
 * session's (ADR 0011), faked here at the port boundary.
 */
function mountDetection({
  spendsNothing,
  separationOwnsMix = false
}: {
  spendsNothing: boolean
  separationOwnsMix?: boolean
}) {
  const store = createStore()
  const detector = {
    detect: vi.fn(async () => ({
      bpm: 120,
      beats: [{ timeSeconds: 0, barPosition: 1 }]
    }))
  }
  const mixer = fakeMixer()
  const wrapper = ({ children }: { readonly children: ReactNode }) => (
    <Provider store={store}>
      <AudioSessionProvider value={{ tempoDetector: detector }}>
        {children}
      </AudioSessionProvider>
    </Provider>
  )
  const detection = renderHook(
    () =>
      useTempoDetection({
        mixer,
        loadedAudio: AUDIO,
        separationOwnsMix,
        autoDetectSpendsNothing: () => spendsNothing
      }),
    { wrapper }
  )
  return { detection, detector, mixer, store }
}

describe('useTempoDetection — the deps are derived, not passed (ADR 0010)', () => {
  it("auto-detects through the session's detector when the run needs no mint", async () => {
    const { detector } = mountDetection({ spendsNothing: true })

    await waitFor(() => expect(detector.detect).toHaveBeenCalledTimes(1))
  })

  it('a successful detection seats the click in the mix on its own', async () => {
    const { mixer } = mountDetection({ spendsNothing: true })

    await waitFor(() => expect(mixer.restore).toHaveBeenCalledOnce())
  })

  it('defers the auto-detection when it would mint — the detector never runs', () => {
    const { detector } = mountDetection({ spendsNothing: false })

    expect(detector.detect).not.toHaveBeenCalled()
  })

  it('the deferred run leaves the tempo on offer (cancelled, not failed)', () => {
    const { store } = mountDetection({ spendsNothing: false })

    expect(store.get(tempoCancelledAtom)).toBe(true)
  })

  it('« Réessayer » is an explicit gesture — it always runs (and may mint)', async () => {
    const { detection, detector } = mountDetection({ spendsNothing: false })

    act(() => detection.result.current.retry())

    await waitFor(() => expect(detector.detect).toHaveBeenCalledTimes(1))
  })
})

describe('useTempoDetection — the tempo lands after the stems (AU.1)', () => {
  it('a detection over a separated mix joins the click to it, muted', async () => {
    const { mixer } = mountDetection({
      spendsNothing: true,
      separationOwnsMix: true
    })

    await waitFor(() => expect(mixer.addStem).toHaveBeenCalledOnce())
    const channel = (mixer.addStem as ReturnType<typeof vi.fn>).mock
      .calls[0]?.[2]
    expect(channel).toEqual(DEFAULT_METRONOME_CHANNEL)
    // The playing stems stay untouched — no track+click restore over them.
    expect(mixer.restore).not.toHaveBeenCalled()
  })

  it('a typed BPM over a separated mix seats the click too — no skip', () => {
    const { detection, mixer } = mountDetection({
      spendsNothing: false,
      separationOwnsMix: true
    })

    act(() => detection.result.current.setBpm(100))

    expect(mixer.addStem).toHaveBeenCalledOnce()
    expect(mixer.restore).not.toHaveBeenCalled()
  })
})
