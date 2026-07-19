// @vitest-environment jsdom
import type { DecodedAudio } from '@app/core'
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { I18nTestingProvider } from '../../i18n/i18n-testing-provider.tsx'
import type { Separation } from '../separation/use-separation.ts'
import type { Tempo } from '../tempo/use-tempo.ts'
import { useStemExport } from './use-stem-export.ts'

const deliverFile = vi.fn()
vi.mock('../../audio/deliver-file.ts', () => ({
  deliverFile: (...args: unknown[]) => deliverFile(...args)
}))

const loadedAudio: DecodedAudio = { sampleRate: 4, channels: [[0, 0, 0, 0]] }

function renderExport() {
  const notifySuccess = vi.fn()
  const hook = renderHook(
    () =>
      useStemExport({
        separation: {
          downloadStem: async () => false
        } as unknown as Separation,
        tempo: { analysis: undefined } as unknown as Tempo,
        metadata: { title: 'Titre' },
        trackName: 'piste',
        loadedAudio,
        durationSeconds: 1,
        notifySuccess
      }),
    { wrapper: I18nTestingProvider }
  )
  return { hook, notifySuccess }
}

describe('useStemExport — honest delivery confirmation', () => {
  it('confirms a delivered lane download with a toast', async () => {
    deliverFile.mockResolvedValue(true)
    const { hook, notifySuccess } = renderExport()
    await act(async () => {
      await hook.result.current.downloadStem('piste')
    })
    expect(deliverFile).toHaveBeenCalledWith(
      'Titre_piste.wav',
      expect.any(Blob)
    )
    expect(notifySuccess).toHaveBeenCalledTimes(1)
  })

  it('stays mute when the desktop save dialog is cancelled', async () => {
    deliverFile.mockResolvedValue(false)
    const { hook, notifySuccess } = renderExport()
    await act(async () => {
      await hook.result.current.downloadStem('piste')
    })
    expect(notifySuccess).not.toHaveBeenCalled()
  })
})
