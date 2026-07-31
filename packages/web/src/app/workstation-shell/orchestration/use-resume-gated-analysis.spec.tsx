// @vitest-environment jsdom
import type { DecodedAudio } from '@app/core'
import { act, renderHook, waitFor } from '@testing-library/react'
import { Provider, createStore } from 'jotai'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AudioSessionProvider } from '../../audio-session/audio-session-provider.tsx'
import type { ChordDetection } from '../../lead-sheet/use-chord-detection.ts'
import type { StructureDetection } from '../../markers/use-structure-detection.ts'
import type { Mixer } from '../../mixer/use-mixer.ts'
import { separationGateReasonAtom } from '../../separation/separation-atoms.ts'
import {
  metronomeEnabledAtom,
  tempoGateReasonAtom
} from '../../tempo/tempo-atoms.ts'
import { useResumeGatedAnalysis } from './use-resume-gated-analysis.ts'

// The analysis gate only engages on the offload path (VITE_ANALYSIS_URL set) —
// pin it OFF so the replayed detection runs token-less, like a local engine.
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

function fakeStructure(gated: boolean): StructureDetection {
  return {
    detecting: false,
    error: undefined,
    gateReason: gated ? 'sign-in-required' : undefined,
    succeeded: false,
    detect: vi.fn(async () => {}),
    cancel: vi.fn()
  }
}

function fakeChords(gated: boolean): ChordDetection {
  return {
    detecting: false,
    error: undefined,
    gateReason: gated ? 'sign-in-required' : undefined,
    succeeded: false,
    phase: undefined,
    detect: vi.fn(async () => {}),
    cancel: vi.fn()
  }
}

/**
 * The hook derives the tempo detection flow from its feature (ADR 0010):
 * nothing reaches it but the mixer seam and values. The detector is the
 * session's (ADR 0011), faked at the port boundary; the gate reasons are
 * seated straight into the features' atoms, exactly as a blocked run left
 * them.
 */
function mountResume({
  tempoGated = false,
  separationGated = false,
  structureGated = false,
  chordsGated = false,
  separationOwnsMix = false,
  noAudio = false
}: {
  tempoGated?: boolean
  separationGated?: boolean
  structureGated?: boolean
  chordsGated?: boolean
  separationOwnsMix?: boolean
  noAudio?: boolean
} = {}) {
  const store = createStore()
  if (tempoGated) {
    store.set(tempoGateReasonAtom, 'sign-in-required')
  }
  if (separationGated) {
    store.set(separationGateReasonAtom, 'sign-in-required')
  }
  const detector = {
    detect: vi.fn(async () => ({
      bpm: 120,
      beats: [{ timeSeconds: 0, barPosition: 1 }]
    }))
  }
  const mixer = fakeMixer()
  const structureDetection = fakeStructure(structureGated)
  const chordDetection = fakeChords(chordsGated)
  const separateAndLoad = vi.fn(async () => undefined)
  const wrapper = ({ children }: { readonly children: ReactNode }) => (
    <Provider store={store}>
      <AudioSessionProvider value={{ tempoDetector: detector }}>
        {children}
      </AudioSessionProvider>
    </Provider>
  )
  const resume = renderHook(
    () =>
      useResumeGatedAnalysis({
        structureDetection,
        chordDetection,
        separateAndLoad,
        loadedAudio: noAudio ? undefined : AUDIO,
        mixer,
        separationOwnsMix
      }),
    { wrapper }
  )
  const replay = () => act(() => resume.result.current())
  return {
    replay,
    detector,
    mixer,
    store,
    structureDetection,
    chordDetection,
    separateAndLoad
  }
}

describe('useResumeGatedAnalysis — the tempo flow is derived, not passed (ADR 0010)', () => {
  it("a gated tempo replays through the session's detector", async () => {
    const { replay, detector } = mountResume({ tempoGated: true })

    replay()

    await waitFor(() => expect(detector.detect).toHaveBeenCalledTimes(1))
  })

  it("the replayed detection seats the session's click on its own", async () => {
    const { replay, mixer, store } = mountResume({ tempoGated: true })

    replay()

    await waitFor(() => expect(mixer.restore).toHaveBeenCalledOnce())
    expect(store.get(metronomeEnabledAtom)).toBe(true)
  })

  it('with a separation owning the mix, the analysis lands but the mix stays intact', async () => {
    const { replay, detector, mixer } = mountResume({
      tempoGated: true,
      separationOwnsMix: true
    })

    replay()

    await waitFor(() => expect(detector.detect).toHaveBeenCalledTimes(1))
    expect(mixer.restore).not.toHaveBeenCalled()
  })

  it('a gated separation replays with the loaded audio', () => {
    const { replay, separateAndLoad } = mountResume({ separationGated: true })

    replay()

    expect(separateAndLoad).toHaveBeenCalledExactlyOnceWith(AUDIO)
  })

  it('gated structure and chords replay their own detect', () => {
    const { replay, structureDetection, chordDetection } = mountResume({
      structureGated: true,
      chordsGated: true
    })

    replay()

    expect(structureDetection.detect).toHaveBeenCalledOnce()
    expect(chordDetection.detect).toHaveBeenCalledOnce()
  })

  it('replays nothing when no flow carries a gate reason', () => {
    const { replay, detector, separateAndLoad, structureDetection, chordDetection } =
      mountResume()

    replay()

    expect(detector.detect).not.toHaveBeenCalled()
    expect(separateAndLoad).not.toHaveBeenCalled()
    expect(structureDetection.detect).not.toHaveBeenCalled()
    expect(chordDetection.detect).not.toHaveBeenCalled()
  })

  it('a gated tempo with no loaded audio replays nothing', () => {
    const { replay, detector } = mountResume({
      tempoGated: true,
      noAudio: true
    })

    replay()

    expect(detector.detect).not.toHaveBeenCalled()
  })
})
