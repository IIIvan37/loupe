// @vitest-environment jsdom
import type {
  ArchiveFile,
  ArchiveWriter,
  DecodedAudio,
  SeparatedStem,
  StemSeparator
} from '@app/core'
import { act, renderHook, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { i18n } from '../../i18n/i18n.ts'
import { I18nTestingProvider } from '../../i18n/i18n-testing-provider.tsx'
import { useSeparation } from './use-separation.ts'

const audio: DecodedAudio = { sampleRate: 4, channels: [[0, 1, -1, 0.5]] }

/** A separator whose result resolves only when the test says so. */
function deferredSeparator(): {
  separator: StemSeparator
  finish: (stems: SeparatedStem[]) => void
} {
  let resolve: (stems: readonly SeparatedStem[]) => void = () => {}
  return {
    separator: {
      separate: () =>
        new Promise<readonly SeparatedStem[]>((r) => {
          resolve = r
        })
    },
    finish: (stems) => resolve(stems)
  }
}

const stems: SeparatedStem[] = [{ id: 'voix', label: 'Voix', audio }]

/** The engine read-back: serve the given stems' PCM by id, like `stemAudio`. */
function pcmOf(loaded: readonly SeparatedStem[]) {
  return (id: string) => loaded.find((stem) => stem.id === id)?.audio
}

describe('useSeparation', () => {
  it('runs a separation to completion and exposes the stems', async () => {
    const { separator, finish } = deferredSeparator()
    const { result } = renderHook(() => useSeparation(pcmOf(stems), separator), {
      wrapper: I18nTestingProvider
    })

    act(() => {
      void result.current.separate(audio)
    })
    expect(result.current.state.status).toBe('analysing')

    await act(async () => {
      finish(stems)
    })
    await waitFor(() => expect(result.current.state.status).toBe('ready'))
    expect(result.current.state.stems.map((s) => s.id)).toEqual(['voix'])
  })


  it('cancels an in-flight run: aborts the port and returns to idle', async () => {
    let seen: AbortSignal | undefined
    const separator: StemSeparator = {
      separate: (_audio, _onProgress, signal) => {
        seen = signal
        return new Promise((_resolve, reject) => {
          signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError'))
          )
        })
      }
    }
    const { result } = renderHook(() => useSeparation(pcmOf(stems), separator), {
      wrapper: I18nTestingProvider
    })

    act(() => {
      void result.current.separate(audio)
    })
    expect(result.current.state.status).toBe('analysing')

    act(() => result.current.cancel())
    expect(result.current.state.status).toBe('idle')
    expect(seen?.aborted).toBe(true)

    // The aborted run's rejection is stale — it must never surface as an error.
    await act(async () => {})
    expect(result.current.state.status).toBe('idle')
  })

  it('rebuilds the ready state from persisted stems without the separator', async () => {
    const { separator } = deferredSeparator()
    const { result } = renderHook(() => useSeparation(pcmOf(stems), separator), {
      wrapper: I18nTestingProvider
    })

    let restored: Awaited<ReturnType<typeof result.current.restore>>
    await act(async () => {
      restored = await result.current.restore(audio, stems)
    })

    // The pipeline re-ran over the stored stems — never touching the separator.
    expect(result.current.state.status).toBe('ready')
    expect(result.current.state.stems.map((s) => s.id)).toEqual(['voix'])
    expect(result.current.sources).toEqual(stems)
    expect(restored?.sources).toEqual(stems)
  })

  it('re-derives sources from the engine PCM instead of retaining a copy', async () => {
    // What the engine's buffers hold — a DIFFERENT object from the separated
    // stems' arrays, so identity proves the hook reads back, never retains.
    const engineView: DecodedAudio = { sampleRate: 4, channels: [[0.25, 0, 0, 0]] }
    const { separator } = deferredSeparator()
    const { result } = renderHook(() => useSeparation(() => engineView, separator), {
      wrapper: I18nTestingProvider
    })

    await act(async () => {
      await result.current.restore(audio, stems)
    })
    expect(result.current.sources.map((s) => s.id)).toEqual(['voix'])
    expect(result.current.sources[0]?.audio).toBe(engineView)
  })

  it('drops a stem whose PCM the engine no longer holds', async () => {
    const { separator } = deferredSeparator()
    const { result } = renderHook(() => useSeparation(() => undefined, separator), {
      wrapper: I18nTestingProvider
    })

    await act(async () => {
      await result.current.restore(audio, stems)
    })
    // The ready state still lists the stems (lanes render from their peaks) —
    // only the PCM-backed view is empty.
    expect(result.current.state.status).toBe('ready')
    expect(result.current.sources).toEqual([])
  })

  it('ignores a stale run that finishes after a reset', async () => {
    const { separator, finish } = deferredSeparator()
    const { result } = renderHook(() => useSeparation(pcmOf(stems), separator), {
      wrapper: I18nTestingProvider
    })

    // Start a run, then reset (as a new import does) before it resolves.
    act(() => {
      void result.current.separate(audio)
    })
    act(() => {
      result.current.reset()
    })
    expect(result.current.state.status).toBe('idle')

    // The abandoned run now resolves — its result must not repopulate state.
    await act(async () => {
      finish(stems)
    })
    expect(result.current.state.status).toBe('idle')
    expect(result.current.state.stems).toEqual([])
  })
})

describe('useSeparation — exportStems (the aligned stem folder)', () => {
  /** Fake archive port: records the files, returns fixed bytes. */
  function fakeArchive(received: ArchiveFile[]): ArchiveWriter {
    return {
      async write(files) {
        received.push(...files)
        return new Uint8Array([9])
      }
    }
  }

  /** The filenames handed to the browser download (anchor `download` attr). */
  let downloaded: string[]

  beforeEach(() => {
    // jsdom implements neither; downloadBlob needs both.
    URL.createObjectURL = vi.fn(() => 'blob:test')
    URL.revokeObjectURL = vi.fn()
    downloaded = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(
      function (this: HTMLAnchorElement) {
        downloaded.push(this.download)
      }
    )
  })

  const silent: DecodedAudio = { sampleRate: 4, channels: [[0, 0, 0, 0]] }
  // Detection masks the silent first stem: only 'Voix' is present/shown.
  const withMasked: SeparatedStem[] = [
    { id: 'basse', label: 'Basse', audio: silent },
    { id: 'voix', label: 'Voix', audio }
  ]

  async function readyHook(archive: ArchiveWriter, ready: SeparatedStem[]) {
    const { separator } = deferredSeparator()
    const { result } = renderHook(
      () => useSeparation(pcmOf(ready), separator, archive),
      { wrapper: I18nTestingProvider }
    )
    await act(async () => {
      await result.current.restore(audio, ready)
    })
    return result
  }

  it('archives only the present stems, numbered by their shown position', async () => {
    const received: ArchiveFile[] = []
    const result = await readyHook(fakeArchive(received), withMasked)
    await act(async () => {
      await result.current.exportStems('Mon morceau')
    })
    expect(received.map((f) => f.name)).toEqual(['01_Voix.wav'])
  })

  it('downloads the zip named after the given base name, reporting success', async () => {
    const result = await readyHook(fakeArchive([]), stems)
    let ok: boolean | undefined
    await act(async () => {
      ok = await result.current.exportStems('Mon morceau')
    })
    expect(downloaded).toEqual(['Mon morceau_stems.zip'])
    expect(ok).toBe(true)
  })

  it('numbers a single-stem download exactly like the zip would, reporting success', async () => {
    const result = await readyHook(fakeArchive([]), withMasked)
    let ok: boolean | undefined
    act(() => {
      ok = result.current.downloadStem('voix')
    })
    // Position among the PRESENT stems (01), not among all sources (02).
    expect(downloaded).toEqual(['01_Voix.wav'])
    expect(ok).toBe(true)
  })

  it('reports no success when the stem to download is gone', async () => {
    const result = await readyHook(fakeArchive([]), withMasked)
    let ok: boolean | undefined
    act(() => {
      ok = result.current.downloadStem('does-not-exist')
    })
    expect(downloaded).toEqual([])
    expect(ok).toBe(false)
  })

  it('drops an export superseded by a reset (no download, no error)', async () => {
    let finishWrite: () => void = () => {}
    const archive: ArchiveWriter = {
      write: () =>
        new Promise((resolve) => {
          finishWrite = () => resolve(new Uint8Array([9]))
        })
    }
    const result = await readyHook(archive, stems)

    let exported: Promise<boolean> = Promise.resolve(false)
    act(() => {
      exported = result.current.exportStems('Mon morceau')
    })
    act(() => {
      result.current.reset()
    })
    let ok: boolean | undefined
    await act(async () => {
      finishWrite()
      ok = await exported
    })
    expect(downloaded).toEqual([])
    expect(ok).toBe(false)
  })

  it('surfaces a failed export as an error message', async () => {
    const archive: ArchiveWriter = {
      write: async () => {
        throw new Error('zip failed')
      }
    }
    const result = await readyHook(archive, stems)
    let ok: boolean | undefined
    await act(async () => {
      ok = await result.current.exportStems('Mon morceau')
    })
    expect(ok).toBe(false)
    expect(result.current.exportError).toBe(
      i18n._('separation.export-failed', { error: 'zip failed' })
    )
  })

  it('dismisses the export error on demand', async () => {
    const archive: ArchiveWriter = {
      write: async () => {
        throw new Error('zip failed')
      }
    }
    const result = await readyHook(archive, stems)
    await act(async () => {
      await result.current.exportStems('Mon morceau')
    })
    act(() => {
      result.current.dismissExportError()
    })
    expect(result.current.exportError).toBeUndefined()
  })
})
