import { unzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { createZipArchiveWriter } from './zip-archive-writer.ts'

describe('createZipArchiveWriter', () => {
  it('produces a zip whose entries round-trip name and bytes', async () => {
    const writer = createZipArchiveWriter()
    const files = [
      { name: '01_Voix.wav', bytes: new Uint8Array([1, 2, 3]) },
      { name: '02_Basse.wav', bytes: new Uint8Array([4, 5]) }
    ]

    const archive = await writer.write(files)

    const unzipped = unzipSync(archive)
    expect(Object.keys(unzipped)).toEqual(['01_Voix.wav', '02_Basse.wav'])
    expect(unzipped['01_Voix.wav']).toEqual(new Uint8Array([1, 2, 3]))
    expect(unzipped['02_Basse.wav']).toEqual(new Uint8Array([4, 5]))
  })

  it('produces an empty zip for no files', async () => {
    const writer = createZipArchiveWriter()
    const archive = await writer.write([])
    expect(Object.keys(unzipSync(archive))).toEqual([])
  })
})
