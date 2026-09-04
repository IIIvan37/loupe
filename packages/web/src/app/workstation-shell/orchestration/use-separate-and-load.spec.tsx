// @vitest-environment jsdom
import type {
  DecodedAudio,
  MixerState,
  SeparatedStem,
  StemSeparator,
  StemTrack,
  TempoAnalysis
} from '@app/core'
import {
  UNITY_GAIN_DB
} from '@app/core'
import { decibels } from '@app/core/testing'
import { act, renderHook } from '@testing-library/react'
import { Provider, createStore } from 'jotai'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nTestingProvider } from '../../../i18n/i18n-testing-provider.tsx'
import { AudioSessionProvider } from '../../audio-session/audio-session-provider.tsx'
import { METRONOME_ID } from '../../mixer/synthetic-stem.ts'
import type { Mixer } from '../../mixer/use-mixer.ts'
import type { MetronomeMixer } from '../../tempo/use-metronome.ts'
import { DEFAULT_METRONOME_CHANNEL } from '../../tempo/metronome-stem.ts'
import { metronomeEnabledAtom, tempoAnalysisAtom } from '../../tempo/tempo-atoms.ts'
import { loadedAudioAtom } from '../../track/track-atoms.ts'
import { useSeparateAndLoad } from './use-separate-and-load.ts'

// The analysis gate only engages on the offload path (VITE_ANALYSIS_URL set) —
// pin it OFF so the token-less local path drives the run.
beforeEach(() => vi.stubEnv('VITE_ANALYSIS_URL', ''))
afterEach(() => vi.unstubAllEnvs())

const AUDIO: DecodedAudio = { sampleRate: 4, channels: [[0, 1, -1, 0.5]] }
const ANALYSIS: TempoAnalysis = {
  bpm: 120,
  grid: [{ timeSeconds: 0, downbeat: true }],
  beatsPerBar: 4
}
// A near-silent stem reads as absent (masked from the track list) — it must
// never become a phantom channel the save would persist.
const SILENT: DecodedAudio = { sampleRate: 4, channels: [[0, 0, 0, 0]] }
const SEPARATED: SeparatedStem[] = [
  { id: 'voix', label: 'Voix', audio: AUDIO },
  { id: 'basse', label: 'Basse', audio: SILENT }
]

function fakeMixer(state: MixerState = []): Pick<Mixer, 'load'> & MetronomeMixer {
  return {
    state,
    load: vi.fn(),
    restore: vi.fn(),
    addStem: vi.fn(),
    replaceStem: vi.fn(),
    toggleMute: vi.fn()
  }
}

/**
 * The hook derives separation and metronome from their features (ADR 0010):
 * nothing reaches it but the mixer seam — the track it separates is the
 * player's atom. The separator is the session's (ADR 0011), faked here at the
 * port boundary.
 */
function mountSeparateAndLoad({
  analysis,
  noAudio = false,
  mixer = fakeMixer(),
  separator = { separate: async () => SEPARATED }
}: {
  analysis?: TempoAnalysis
  /** Mount before any import: the player's atom stays empty. */
  noAudio?: boolean
  mixer?: Pick<Mixer, 'load'> & MetronomeMixer
  separator?: StemSeparator
} = {}) {
  const store = createStore()
  store.set(loadedAudioAtom, noAudio ? undefined : AUDIO)
  if (analysis) {
    store.set(tempoAnalysisAtom, analysis)
  }
  const wrapper = ({ children }: { readonly children: ReactNode }) => (
    <I18nTestingProvider>
      <Provider store={store}>
        <AudioSessionProvider value={{ separator }}>
          {children}
        </AudioSessionProvider>
      </Provider>
    </I18nTestingProvider>
  )
  const hook = renderHook(() => useSeparateAndLoad({ mixer }), { wrapper })
  return { hook, mixer, store }
}

async function separate(
  hook: ReturnType<typeof renderHook<ReturnType<typeof useSeparateAndLoad>, unknown>>
) {
  let sources: readonly SeparatedStem[] | undefined
  await act(async () => {
    sources = await hook.result.current()
  })
  return sources
}

describe('useSeparateAndLoad — the deps are derived, not passed (ADR 0010)', () => {
  it('without a known tempo, loads the separated stems straight into the mix', async () => {
    const { hook, mixer } = mountSeparateAndLoad()

    const sources = await separate(hook)

    expect(mixer.load).toHaveBeenCalledOnce()
    expect(sources).toEqual(SEPARATED)
  })

  it('with a known tempo, one restore seats the stems and the click together', async () => {
    const { hook, mixer } = mountSeparateAndLoad({ analysis: ANALYSIS })

    await separate(hook)

    expect(mixer.load).not.toHaveBeenCalled()
    expect(mixer.restore).toHaveBeenCalledOnce()
    const [stems, , channels] = (mixer.restore as ReturnType<typeof vi.fn>).mock
      .calls[0] as [readonly StemTrack[], unknown, MixerState]
    expect(stems.map((stem) => stem.id)).toEqual([
      'voix',
      'basse',
      METRONOME_ID
    ])
    // Only PRESENT stems get a channel: the masked « basse » never becomes a
    // phantom channel the save would persist.
    expect(channels).toEqual([
      { id: 'voix', gainDb: UNITY_GAIN_DB, muted: false, soloed: false },
      DEFAULT_METRONOME_CHANNEL
    ])
  })

  it("the click it seats is the session's — every metronome instance sees it", async () => {
    const { hook, store } = mountSeparateAndLoad({ analysis: ANALYSIS })

    await separate(hook)

    expect(store.get(metronomeEnabledAtom)).toBe(true)
  })

  it("carries the mixer's current click settings, not the default", async () => {
    const seated = { id: METRONOME_ID, gainDb: decibels(-6), muted: false, soloed: false }
    const mixer = fakeMixer([seated])
    const { hook } = mountSeparateAndLoad({ analysis: ANALYSIS, mixer })

    await separate(hook)

    const [, , channels] = (mixer.restore as ReturnType<typeof vi.fn>).mock
      .calls[0] as [unknown, unknown, MixerState]
    expect(channels).toContainEqual(seated)
  })

  it('a tempo landing DURING the separation still seats the click (AU.1)', async () => {
    let resolveStems: (stems: SeparatedStem[]) => void = () => {}
    const separator: StemSeparator = {
      separate: () =>
        new Promise((resolve) => {
          resolveStems = resolve
        })
    }
    const { hook, mixer, store } = mountSeparateAndLoad({ separator })

    let pending: Promise<readonly SeparatedStem[] | undefined> | undefined
    act(() => {
      pending = hook.result.current()
    })
    // The analysis lands while the stems are still separating (~70 s) — the
    // handler's render-time snapshot predates it.
    act(() => {
      store.set(tempoAnalysisAtom, ANALYSIS)
    })
    await act(async () => {
      resolveStems(SEPARATED)
      await pending
    })

    // Stems and click seat together — not the tempo-less plain load.
    expect(mixer.restore).toHaveBeenCalledOnce()
    expect(mixer.load).not.toHaveBeenCalled()
    expect(store.get(metronomeEnabledAtom)).toBe(true)
  })

  it('resolves undefined and touches nothing when no audio is loaded', async () => {
    const { hook, mixer } = mountSeparateAndLoad({ noAudio: true })

    const sources = await separate(hook)

    expect(sources).toBeUndefined()
    expect(mixer.load).not.toHaveBeenCalled()
    expect(mixer.restore).not.toHaveBeenCalled()
  })
})
