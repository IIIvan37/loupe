// @vitest-environment jsdom
import type { DecodedAudio } from '@app/core'
import { act, renderHook } from '@testing-library/react'
import { Provider, createStore } from 'jotai'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { I18nTestingProvider } from '../../../i18n/i18n-testing-provider.tsx'
import type { Separation } from '../../separation/use-separation.ts'
import type { Tempo } from '../../tempo/use-tempo.ts'
import { loadedAudioAtom } from '../../track/track-atoms.ts'
import { useStemExport } from './use-stem-export.ts'

const downloadBlob = vi.fn()
vi.mock('../../../audio/download-blob.ts', () => ({
  downloadBlob: (...args: unknown[]) => downloadBlob(...args)
}))

const loadedAudio: DecodedAudio = { sampleRate: 4, channels: [[0, 0, 0, 0]] }

function renderExport() {
  const notifySuccess = vi.fn()
  // The track is the player's atom (ADR 0010) — seat it, not pass it.
  const store = createStore()
  store.set(loadedAudioAtom, loadedAudio)
  const wrapper = ({ children }: { readonly children: ReactNode }) => (
    <I18nTestingProvider>
      <Provider store={store}>{children}</Provider>
    </I18nTestingProvider>
  )
  const hook = renderHook(
    () =>
      useStemExport({
        separation: {
          downloadStem: async () => false
        } as unknown as Separation,
        tempo: { analysis: undefined } as unknown as Tempo,
        metadata: { title: 'Titre' },
        trackName: 'piste',
        durationSeconds: 1,
        notifySuccess
      }),
    { wrapper }
  )
  return { hook, notifySuccess }
}

describe('useStemExport — honest delivery confirmation', () => {
  it('confirms a delivered lane download with a toast', async () => {
    const { hook, notifySuccess } = renderExport()
    await act(async () => {
      await hook.result.current.downloadStem('piste')
    })
    expect(downloadBlob).toHaveBeenCalledWith(
      'Titre_piste.wav',
      expect.any(Blob)
    )
    expect(notifySuccess).toHaveBeenCalledTimes(1)
  })
})
