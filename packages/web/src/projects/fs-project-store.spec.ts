import type { Project } from '@app/core'
import { projectStoreContract } from '@app/core/testing'
import { describe, expect, it } from 'vitest'
import { sha256Hex } from './content-hash.ts'
import {
  collectFsGarbage,
  createFsProjectAudioStore,
  createFsProjectStore,
  type ProjectFs
} from './fs-project-store.ts'
import { memoryProjectFs as memoryFs } from './project-fs-test-kit.ts'

const project: Project = {
  id: 'p1',
  name: 'My take',
  createdAt: 1000,
  updatedAt: 1000,
  source: { title: 'Song', artist: 'Band', audioRef: 'a'.repeat(64) },
  loops: [],
  markers: []
}

const wavBytes = new TextEncoder().encode('wav')

// The port's obligations, replayed against this adapter — same suite the
// in-memory reference passes (packages/core/src/testing).
projectStoreContract('createFsProjectStore', () => ({
  store: createFsProjectStore(memoryFs().fs)
}))

describe('createFsProjectStore', () => {
  it('round-trips a manifest through projects/{id}.json', async () => {
    const { fs, files } = memoryFs()
    const store = createFsProjectStore(fs)

    await store.save(project)

    expect(JSON.parse(String(files.get('projects/p1.json')))).toEqual(project)
    expect(await store.load('p1')).toEqual(project)
  })

  it('writes the manifest to a temp file then renames it into place', async () => {
    const { fs, files, log } = memoryFs()

    await createFsProjectStore(fs).save(project)

    expect(log).toEqual([
      'write projects/p1.json.tmp',
      'rename projects/p1.json.tmp -> projects/p1.json'
    ])
    expect(files.has('projects/p1.json.tmp')).toBe(false)
  })

  it('resolves an unknown id to undefined', async () => {
    const { fs } = memoryFs()
    expect(await createFsProjectStore(fs).load('nope')).toBeUndefined()
  })

  it('resolves a path-hostile id to undefined without touching the fs', async () => {
    const { fs } = memoryFs()
    expect(await createFsProjectStore(fs).load('../etc/passwd')).toBeUndefined()
  })

  it('refuses to save a project whose id is path-hostile', async () => {
    const { fs, files } = memoryFs()
    const hostile = { ...project, id: '../escape' }

    await expect(createFsProjectStore(fs).save(hostile)).rejects.toThrow()
    expect(files.size).toBe(0)
  })

  it('throws « unreadable » on a corrupt or invalid manifest', async () => {
    const { fs, files } = memoryFs()
    files.set('projects/bad.json', '{ not json')
    files.set('projects/hollow.json', JSON.stringify({ id: 'hollow' }))

    const store = createFsProjectStore(fs)
    await expect(store.load('bad')).rejects.toThrow(/unreadable/i)
    await expect(store.load('hollow')).rejects.toThrow(/unreadable/i)
  })

  it('lists every readable manifest and skips corrupt or invalid ones', async () => {
    const { fs, files } = memoryFs()
    files.set('projects/p1.json', JSON.stringify(project))
    files.set('projects/bad.json', '{ not json')
    files.set('projects/hollow.json', JSON.stringify({ id: 'hollow' }))
    files.set('projects/stray.txt', 'not a manifest')

    expect(await createFsProjectStore(fs).list()).toEqual([project])
  })

  it('keeps listing when one manifest read fails (deleted mid-listing)', async () => {
    const { fs, files } = memoryFs()
    files.set('projects/p1.json', JSON.stringify(project))
    files.set('projects/gone.json', JSON.stringify(project))
    const flaky: ProjectFs = {
      ...fs,
      readTextFile: (path: string) =>
        path.endsWith('gone.json')
          ? Promise.reject(new Error('no such file'))
          : fs.readTextFile(path)
    }

    expect(await createFsProjectStore(flaky).list()).toEqual([project])
  })

  it('deletes a manifest and treats an unknown id as a no-op', async () => {
    const { fs, files } = memoryFs()
    files.set('projects/p1.json', JSON.stringify(project))

    const store = createFsProjectStore(fs)
    await store.delete('p1')
    await store.delete('p1')

    expect(files.size).toBe(0)
  })

  it('refuses to delete a path-hostile id', async () => {
    const { fs } = memoryFs()
    await expect(createFsProjectStore(fs).delete('../escape')).rejects.toThrow()
  })
})

describe('createFsProjectAudioStore', () => {
  it('stores bytes under their sha256 — the shared addressing contract', async () => {
    const { fs, files } = memoryFs()

    const ref = await createFsProjectAudioStore(fs).put(
      wavBytes.buffer as ArrayBuffer
    )

    expect(ref).toBe(await sha256Hex(wavBytes.buffer as ArrayBuffer))
    expect(files.get(`audio/${ref}`)).toEqual(wavBytes)
  })

  it('writes the blob to a temp file then renames it into place', async () => {
    const { fs, log } = memoryFs()

    const ref = await createFsProjectAudioStore(fs).put(
      wavBytes.buffer as ArrayBuffer
    )

    expect(log).toEqual([
      `write audio/${ref}.tmp`,
      `rename audio/${ref}.tmp -> audio/${ref}`
    ])
  })

  it('skips the write when the same bytes are already stored (dedup)', async () => {
    const { fs, log } = memoryFs()
    const store = createFsProjectAudioStore(fs)

    const first = await store.put(wavBytes.buffer as ArrayBuffer)
    const again = await store.put(wavBytes.buffer as ArrayBuffer)

    expect(again).toBe(first)
    expect(log).toHaveLength(2)
  })

  it('gets bytes back and resolves an unknown ref to undefined', async () => {
    const { fs } = memoryFs()
    const store = createFsProjectAudioStore(fs)
    const ref = await store.put(wavBytes.buffer as ArrayBuffer)

    const fetched = await store.get(ref)
    expect(fetched && new TextDecoder().decode(fetched)).toBe('wav')
    expect(await store.get('f'.repeat(64))).toBeUndefined()
  })

  it('resolves a non-sha256 ref to undefined without touching the fs', async () => {
    const { fs } = memoryFs()
    expect(
      await createFsProjectAudioStore(fs).get('../../../etc/passwd')
    ).toBeUndefined()
  })
})

describe('collectFsGarbage', () => {
  const liveRef = 'a'.repeat(64)
  const stemRef = 'b'.repeat(64)
  const orphanRef = 'c'.repeat(64)

  it('deletes blobs no manifest references, wherever a ref sits in the tree', async () => {
    const { fs, files } = memoryFs()
    files.set(
      'projects/p1.json',
      JSON.stringify({
        ...project,
        source: { ...project.source, audioRef: liveRef },
        separation: {
          stems: [{ id: 's1', label: 'V', audioRef: stemRef }],
          mixer: [{ id: 's1', gainDb: 0, muted: false, soloed: false }]
        }
      })
    )
    files.set(`audio/${liveRef}`, wavBytes)
    files.set(`audio/${stemRef}`, wavBytes)
    files.set(`audio/${orphanRef}`, wavBytes)

    const report = await collectFsGarbage(fs)

    expect(report).toEqual({ deleted: 1, kept: 2, skipped: false })
    expect(files.has(`audio/${orphanRef}`)).toBe(false)
    expect(files.has(`audio/${liveRef}`)).toBe(true)
    expect(files.has(`audio/${stemRef}`)).toBe(true)
  })

  it('deletes nothing when any manifest is unparseable (conservative)', async () => {
    const { fs, files } = memoryFs()
    files.set('projects/p1.json', '{ not json')
    files.set(`audio/${orphanRef}`, wavBytes)

    const report = await collectFsGarbage(fs)

    expect(report).toEqual({ deleted: 0, kept: 0, skipped: true })
    expect(files.has(`audio/${orphanRef}`)).toBe(true)
  })

  it('leaves temp files and stray names alone', async () => {
    const { fs, files } = memoryFs()
    files.set(`audio/${orphanRef}.tmp`, wavBytes)
    files.set('audio/notes.txt', wavBytes)

    const report = await collectFsGarbage(fs)

    expect(report).toEqual({ deleted: 0, kept: 0, skipped: false })
    expect(files.has(`audio/${orphanRef}.tmp`)).toBe(true)
    expect(files.has('audio/notes.txt')).toBe(true)
  })
})
