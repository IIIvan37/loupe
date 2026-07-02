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

describe('exportStems — the aligned stem folder', () => {
  it('archives one numbered WAV per stem, in display order', async () => {
    const received: ArchiveFile[] = []
    const result = await exportStems(
      {
        stems: [stem('vox', 'Voix', [0, 1]), stem('drums', 'Batterie', [1, 0])]
      },
      { archive: fakeArchive(received) }
    )
    expectOk(result)
    expect(received.map((f) => f.name)).toEqual([
      '01_Voix.wav',
      '02_Batterie.wav'
    ])
    expect(result.archive).toEqual(new Uint8Array([1, 2, 3]))
  })

  it('encodes each stem as a decodable WAV carrying its own PCM', async () => {
    const received: ArchiveFile[] = []
    const result = await exportStems(
      { stems: [stem('vox', 'Voix', [0, 1, -1, 0])] },
      { archive: fakeArchive(received) }
    )
    expectOk(result)
    const wav = received[0]
    if (!wav) throw new Error('expected one file')
    const decoded = decodeWav(wav.bytes.slice().buffer)
    expect(decoded.sampleRate).toBe(4)
    expect(Array.from(decoded.channels[0] ?? [])).toEqual([0, 1, -1, 0])
  })

  it('zero-pads shorter stems so every WAV has the same duration (t=0 aligned)', async () => {
    const received: ArchiveFile[] = []
    const result = await exportStems(
      {
        stems: [
          stem('vox', 'Voix', [1, -1]),
          stem('bass', 'Basse', [1, -1, 1, -1])
        ]
      },
      { archive: fakeArchive(received) }
    )
    expectOk(result)
    const decoded = received.map((f) => decodeWav(f.bytes.slice().buffer))
    expect(decoded.map((d) => d.channels[0]?.length)).toEqual([4, 4])
    expect(Array.from(decoded[0]?.channels[0] ?? [])).toEqual([1, -1, 0, 0])
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
