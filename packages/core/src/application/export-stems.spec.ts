import { describe, expect, it } from 'vitest'
import { decodeWav } from '../domain/wav-decoder.ts'
import { type ExportStemsResult, exportStems } from './export-stems.ts'
import type { ArchiveFile, ArchiveWriter, SeparatedStem } from './ports.ts'

/** Fake archive: records the files it received and returns fixed bytes. */
function fakeArchive(received: ArchiveFile[]): ArchiveWriter {
  return {
    async write(files) {
      received.push(...files)
      return new Uint8Array([1, 2, 3])
    }
  }
}

function stem(
  id: string,
  label: string,
  samples: readonly number[]
): SeparatedStem {
  return { id, label, audio: { sampleRate: 4, channels: [samples] } }
}

function expectOk(
  result: ExportStemsResult
): asserts result is Extract<ExportStemsResult, { ok: true }> {
  if (!result.ok) throw new Error(`expected ok, got "${result.error}"`)
}

async function exportTwo(received: ArchiveFile[]): Promise<ExportStemsResult> {
  return exportStems(
    {
      stems: [stem('vox', 'Voix', [0, 1]), stem('drums', 'Batterie', [1, 0])]
    },
    { archive: fakeArchive(received) }
  )
}

describe('exportStems — the aligned stem folder', () => {
  it('archives one numbered WAV per stem, in display order', async () => {
    const received: ArchiveFile[] = []
    await exportTwo(received)
    expect(received.map((f) => f.name)).toEqual([
      '01_Voix.wav',
      '02_Batterie.wav'
    ])
  })

  it('returns the archive bytes the writer produced', async () => {
    const result = await exportTwo([])
    expectOk(result)
    expect(result.archive).toEqual(new Uint8Array([1, 2, 3]))
  })

  async function decodeSingleExport(samples: readonly number[]) {
    const received: ArchiveFile[] = []
    const result = await exportStems(
      { stems: [stem('vox', 'Voix', samples)] },
      { archive: fakeArchive(received) }
    )
    expectOk(result)
    const wav = received[0]
    if (!wav) throw new Error('expected one file')
    return decodeWav(wav.bytes.slice().buffer)
  }

  it('encodes a WAV that keeps the stem sample rate', async () => {
    const decoded = await decodeSingleExport([0, 1, -1, 0])
    expect(decoded.sampleRate).toBe(4)
  })

  it('encodes a WAV carrying the stem PCM', async () => {
    const decoded = await decodeSingleExport([0, 1, -1, 0])
    expect(Array.from(decoded.channels[0] ?? [])).toEqual([0, 1, -1, 0])
  })

  async function decodeAligned(stems: readonly SeparatedStem[]) {
    const received: ArchiveFile[] = []
    const result = await exportStems(
      { stems },
      { archive: fakeArchive(received) }
    )
    expectOk(result)
    return received.map((f) => decodeWav(f.bytes.slice().buffer))
  }

  it('gives every WAV the longest stem duration (t=0 aligned)', async () => {
    const decoded = await decodeAligned([
      stem('vox', 'Voix', [1, -1]),
      stem('bass', 'Basse', [1, -1, 1, -1])
    ])
    expect(decoded.map((d) => d.channels[0]?.length)).toEqual([4, 4])
  })

  it('pads a shorter stem with trailing silence', async () => {
    const decoded = await decodeAligned([
      stem('vox', 'Voix', [1, -1]),
      stem('bass', 'Basse', [1, -1, 1, -1])
    ])
    expect(Array.from(decoded[0]?.channels[0] ?? [])).toEqual([1, -1, 0, 0])
  })

  it('covers every channel: a longer second channel sets the duration too', async () => {
    const uneven: SeparatedStem = {
      id: 'vox',
      label: 'Voix',
      audio: {
        sampleRate: 4,
        channels: [
          [1, -1],
          [1, -1, 1, -1]
        ]
      }
    }
    const decoded = await decodeAligned([uneven])
    expect(decoded[0]?.channels.map((c) => c.length)).toEqual([4, 4])
  })
})

describe('exportStems — expected failures are a Result', () => {
  it('rejects an empty stem list', async () => {
    const result = await exportStems(
      { stems: [] },
      { archive: fakeArchive([]) }
    )
    expect(result).toEqual({ ok: false, error: 'No stems to export' })
  })

  it('rejects stems with mismatched sample rates (they cannot align)', async () => {
    const drums: SeparatedStem = {
      id: 'drums',
      label: 'Batterie',
      audio: { sampleRate: 8, channels: [[0, 0]] }
    }
    const result = await exportStems(
      { stems: [stem('vox', 'Voix', [0, 0]), drums] },
      { archive: fakeArchive([]) }
    )
    expect(result).toEqual({
      ok: false,
      error: 'Stems have mismatched sample rates'
    })
  })

  it('rejects a stem with no channels (encodeWav refuses it)', async () => {
    const empty: SeparatedStem = {
      id: 'vox',
      label: 'Voix',
      audio: { sampleRate: 4, channels: [] }
    }
    const result = await exportStems(
      { stems: [empty] },
      { archive: fakeArchive([]) }
    )
    expect(result).toEqual({
      ok: false,
      error: 'at least one channel is required'
    })
  })

  it('turns a throwing archive writer into a typed error Result', async () => {
    const archive: ArchiveWriter = {
      write: async () => {
        throw new Error('zip failed')
      }
    }
    const result = await exportStems(
      { stems: [stem('vox', 'Voix', [0])] },
      { archive }
    )
    expect(result).toEqual({ ok: false, error: 'zip failed' })
  })
})
