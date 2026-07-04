import { describe, expect, it } from 'vitest'
import type { MixerState } from '../domain/mixer.ts'
import type { AudioRef, Project } from '../domain/project.ts'
import type { ProjectAudioStore, ProjectStore } from './ports.ts'
import {
  deleteProject,
  listProjects,
  openProject,
  saveProject
} from './projects.ts'

function fakeProjectStore(
  initial: readonly Project[] = []
): ProjectStore & { readonly saved: Map<string, Project> } {
  const saved = new Map(initial.map((p) => [p.id, p]))
  return {
    saved,
    async list() {
      return [...saved.values()]
    },
    async load(id) {
      return saved.get(id)
    },
    async save(project) {
      saved.set(project.id, project)
    },
    async delete(id) {
      saved.delete(id)
    }
  }
}

function fakeAudioStore(): ProjectAudioStore & {
  readonly blobs: Map<AudioRef, ArrayBuffer>
} {
  const blobs = new Map<AudioRef, ArrayBuffer>()
  return {
    blobs,
    async put(bytes) {
      const ref = `audio-${blobs.size + 1}`
      blobs.set(ref, bytes)
      return ref
    },
    async get(ref) {
      return blobs.get(ref)
    }
  }
}

const boom = async (): Promise<never> => {
  throw new Error('disk full')
}
const failingStore: ProjectStore = {
  list: boom,
  load: boom,
  save: boom,
  delete: boom
}

function bytesOf(text: string): ArrayBuffer {
  return new TextEncoder().encode(text).buffer as ArrayBuffer
}

const sourceBytes = bytesOf('source-pcm')
const marker = { id: 'm1', timeSeconds: 12, label: 'Solo' }
const loop = {
  id: 'l1',
  name: 'Verse',
  region: { startSeconds: 1, endSeconds: 3 }
}
const mixer: MixerState = [
  { id: 'vocals', gainDb: 0, muted: false, soloed: false }
]

const saveInput = {
  stamp: { id: 'p1', name: 'My song', now: 1000 },
  source: { title: 'Song', artist: 'Band', bytes: sourceBytes },
  loops: [loop],
  markers: [marker]
}

const saveInputWithSeparation = {
  ...saveInput,
  separation: {
    stems: [{ id: 'vocals', label: 'Voix', bytes: bytesOf('vocals-wav') }],
    mixer
  }
}

describe('saveProject', () => {
  it('stores the heavy audio, assembles the project around its ref, and persists it', async () => {
    const store = fakeProjectStore()
    const audio = fakeAudioStore()

    const result = await saveProject(saveInput, { store, audio })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.project).toEqual({
      id: 'p1',
      name: 'My song',
      createdAt: 1000,
      updatedAt: 1000,
      source: { title: 'Song', artist: 'Band', audioRef: 'audio-1' },
      loops: [loop],
      markers: [marker]
    })
    expect(store.saved.get('p1')).toEqual(result.project)
    expect(audio.blobs.get('audio-1')).toBe(sourceBytes)
  })

  it('persists the armed A/B region (the loupe) into the manifest', async () => {
    const store = fakeProjectStore()
    const activeLoop = {
      region: { startSeconds: 1.5, endSeconds: 6 },
      enabled: true
    }

    await saveProject(
      { ...saveInput, activeLoop },
      { store, audio: fakeAudioStore() }
    )

    expect(store.saved.get('p1')?.activeLoop).toEqual(activeLoop)
  })

  it('persists the playback tuning (tempo, pitch, zoom) into the manifest', async () => {
    const store = fakeProjectStore()
    const tuning = { timeRatio: 0.85, pitchSemitones: -2, zoom: 3 }

    await saveProject(
      { ...saveInput, tuning },
      { store, audio: fakeAudioStore() }
    )

    expect(store.saved.get('p1')?.tuning).toEqual(tuning)
  })

  it('persists the tempo analysis and metronome settings into the manifest', async () => {
    const store = fakeProjectStore()
    const tempo = {
      bpm: 96,
      grid: [
        { timeSeconds: 0, downbeat: true },
        { timeSeconds: 0.625, downbeat: false }
      ],
      metronome: {
        id: 'metronome',
        gainDb: -3,
        muted: false,
        soloed: false
      }
    }

    await saveProject(
      { ...saveInput, tempo },
      { store, audio: fakeAudioStore() }
    )

    expect(store.saved.get('p1')?.tempo).toEqual(tempo)
  })

  it('stores each stem behind its own ref and keeps the mixer', async () => {
    const store = fakeProjectStore()
    const audio = fakeAudioStore()

    const result = await saveProject(saveInputWithSeparation, { store, audio })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.project.separation).toEqual({
      stems: [{ id: 'vocals', label: 'Voix', audioRef: 'audio-2' }],
      mixer
    })
    expect(audio.blobs.size).toBe(2)
  })

  it('re-saving an existing project keeps createdAt and bumps updatedAt', async () => {
    const store = fakeProjectStore()
    const audio = fakeAudioStore()
    await saveProject(saveInput, { store, audio })

    const result = await saveProject(
      { ...saveInput, stamp: { id: 'p1', name: 'My song v2', now: 2000 } },
      { store, audio }
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.project.createdAt).toBe(1000)
    expect(result.project.updatedAt).toBe(2000)
    expect(result.project.name).toBe('My song v2')
  })

  it('reports a failing store as an error result', async () => {
    const result = await saveProject(saveInput, {
      store: failingStore,
      audio: fakeAudioStore()
    })
    expect(result).toEqual({ ok: false, error: 'disk full' })
  })

  it('rejects a separation whose mixer channels do not match its stems, before storing any audio', async () => {
    const store = fakeProjectStore()
    const audio = fakeAudioStore()

    const result = await saveProject(
      {
        ...saveInput,
        separation: {
          stems: [{ id: 'vocals', label: 'Voix', bytes: bytesOf('v') }],
          mixer: [
            { id: 'vocals', gainDb: 0, muted: false, soloed: false },
            { id: 'drums', gainDb: 0, muted: false, soloed: false }
          ]
        }
      },
      { store, audio }
    )

    expect(result).toEqual({
      ok: false,
      error: 'Mixer channels do not match the stems'
    })
    expect(audio.blobs.size).toBe(0)
    expect(store.saved.size).toBe(0)
  })
})

describe('listProjects', () => {
  it('returns the saved projects, most recently updated first', async () => {
    const store = fakeProjectStore()
    const audio = fakeAudioStore()
    await saveProject(saveInput, { store, audio })
    await saveProject(
      { ...saveInput, stamp: { id: 'p2', name: 'Newer', now: 5000 } },
      { store, audio }
    )

    const result = await listProjects({ store })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.projects.map((p) => p.id)).toEqual(['p2', 'p1'])
  })

  it('reports a failing store as an error result', async () => {
    const result = await listProjects({ store: failingStore })
    expect(result).toEqual({ ok: false, error: 'disk full' })
  })
})

describe('openProject', () => {
  it('returns the project with its source and stem bytes resolved', async () => {
    const store = fakeProjectStore()
    const audio = fakeAudioStore()
    await saveProject(saveInputWithSeparation, { store, audio })

    const result = await openProject({ id: 'p1' }, { store, audio })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.project.id).toBe('p1')
    expect(result.sourceBytes).toBe(sourceBytes)
    expect(result.stems).toEqual([
      { id: 'vocals', bytes: audio.blobs.get('audio-2') }
    ])
  })

  it('opens a project that was saved without separation', async () => {
    const store = fakeProjectStore()
    const audio = fakeAudioStore()
    await saveProject(saveInput, { store, audio })

    const result = await openProject({ id: 'p1' }, { store, audio })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.stems).toEqual([])
  })

  it('reports an unknown id as an error result', async () => {
    const result = await openProject(
      { id: 'nope' },
      { store: fakeProjectStore(), audio: fakeAudioStore() }
    )
    expect(result).toEqual({ ok: false, error: 'Unknown project "nope"' })
  })

  it('reports missing audio bytes as an error result', async () => {
    const store = fakeProjectStore()
    const audio = fakeAudioStore()
    await saveProject(saveInput, { store, audio })
    audio.blobs.clear()

    const result = await openProject({ id: 'p1' }, { store, audio })

    expect(result).toEqual({
      ok: false,
      error: 'Missing audio for ref "audio-1"'
    })
  })
})

describe('deleteProject', () => {
  it('removes the project from the store', async () => {
    const store = fakeProjectStore()
    const audio = fakeAudioStore()
    await saveProject(saveInput, { store, audio })

    const result = await deleteProject({ id: 'p1' }, { store })

    expect(result).toEqual({ ok: true })
    expect(store.saved.size).toBe(0)
  })

  it('reports a failing store as an error result', async () => {
    const result = await deleteProject({ id: 'p1' }, { store: failingStore })
    expect(result).toEqual({ ok: false, error: 'disk full' })
  })
})
