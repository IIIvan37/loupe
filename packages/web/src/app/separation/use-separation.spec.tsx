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

describe('useSeparation', () => {
  it('runs a separation to completion and exposes the stems', async () => {
    const { separator, finish } = deferredSeparator()
    const { result } = renderHook(() => useSeparation(separator))

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

  it('rebuilds the ready state from persisted stems without the separator', async () => {
    const { separator } = deferredSeparator()
    const { result } = renderHook(() => useSeparation(separator))

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

  it('ignores a stale run that finishes after a reset', async () => {
    const { separator, finish } = deferredSeparator()
    const { result } = renderHook(() => useSeparation(separator))

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

  beforeEach(() => {
    // jsdom implements neither; downloadBlob needs both.
    URL.createObjectURL = vi.fn(() => 'blob:test')
    URL.revokeObjectURL = vi.fn()
  })

  async function readyHook(archive: ArchiveWriter, ready: SeparatedStem[]) {
    const { separator } = deferredSeparator()
    const { result } = renderHook(() => useSeparation(separator, archive))
    await act(async () => {
      await result.current.restore(audio, ready)
    })
    return result
  }

  it('archives only the present stems, then downloads the named zip', async () => {
    const received: ArchiveFile[] = []
    const silent: DecodedAudio = { sampleRate: 4, channels: [[0, 0, 0, 0]] }
    const result = await readyHook(fakeArchive(received), [
      { id: 'voix', label: 'Voix', audio },
      { id: 'basse', label: 'Basse', audio: silent }
    ])

    await act(async () => {
      await result.current.exportStems('Mon morceau')
    })

    // The silent stem was masked by detection, so the folder skips it.
    expect(received.map((f) => f.name)).toEqual(['01_Voix.wav'])
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
    expect(result.current.exportError).toBeUndefined()
  })

  it('surfaces a failed export as a dismissible error', async () => {
    const archive: ArchiveWriter = {
      write: async () => {
        throw new Error('zip failed')
      }
    }
    const result = await readyHook(archive, stems)

    await act(async () => {
      await result.current.exportStems('Mon morceau')
    })
    expect(result.current.exportError).toBe("L'export a échoué : zip failed")

    act(() => {
      result.current.dismissExportError()
    })
    expect(result.current.exportError).toBeUndefined()
  })
})
