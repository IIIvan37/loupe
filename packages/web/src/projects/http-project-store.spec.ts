import type { Project } from '@app/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createHttpProjectAudioStore,
  createHttpProjectStore
} from './http-project-store.ts'

const BASE = 'http://localhost:8000'

const project: Project = {
  id: 'p1',
  name: 'My take',
  createdAt: 1000,
  updatedAt: 1000,
  source: { title: 'Song', artist: 'Band', audioRef: 'abc' },
  loops: [],
  markers: []
}

afterEach(() => {
  vi.restoreAllMocks()
})

function stubFetch(...responses: Response[]): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn<typeof fetch>()
  for (const response of responses) {
    fetchMock.mockResolvedValueOnce(response)
  }
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('createHttpProjectStore', () => {
  it('lists the manifests from GET /projects', async () => {
    const fetchMock = stubFetch(Response.json([project]))

    const projects = await createHttpProjectStore(BASE).list()

    expect(fetchMock.mock.calls[0]?.[0]).toBe(`${BASE}/projects`)
    expect(projects).toEqual([project])
  })

  it('loads one manifest and resolves an unknown id to undefined', async () => {
    stubFetch(Response.json(project), new Response(null, { status: 404 }))

    const store = createHttpProjectStore(BASE)
    expect(await store.load('p1')).toEqual(project)
    expect(await store.load('nope')).toBeUndefined()
  })

  it('saves a manifest as PUT /projects/{id} with a JSON body', async () => {
    const fetchMock = stubFetch(new Response(null, { status: 204 }))

    await createHttpProjectStore(BASE).save(project)

    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(url).toBe(`${BASE}/projects/p1`)
    expect(init?.method).toBe('PUT')
    expect(JSON.parse(String(init?.body))).toEqual(project)
  })

  it('deletes via DELETE /projects/{id}', async () => {
    const fetchMock = stubFetch(new Response(null, { status: 204 }))

    await createHttpProjectStore(BASE).delete('p1')

    expect(fetchMock.mock.calls[0]?.[0]).toBe(`${BASE}/projects/p1`)
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe('DELETE')
  })

  it('throws on a failing response so use-cases surface an error result', async () => {
    stubFetch(new Response(null, { status: 500 }))

    await expect(createHttpProjectStore(BASE).list()).rejects.toThrow('500')
  })
})

describe('createHttpProjectAudioStore', () => {
  it('puts bytes to POST /audio and returns the server-minted ref', async () => {
    const fetchMock = stubFetch(Response.json({ ref: 'abc' }))
    const bytes = new TextEncoder().encode('wav').buffer as ArrayBuffer

    const ref = await createHttpProjectAudioStore(BASE).put(bytes)

    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(url).toBe(`${BASE}/audio`)
    expect(init?.method).toBe('POST')
    expect(init?.body).toBe(bytes)
    expect(ref).toBe('abc')
  })

  it('gets bytes back and resolves an unknown ref to undefined', async () => {
    const bytes = new TextEncoder().encode('wav').buffer as ArrayBuffer
    stubFetch(
      new Response(bytes, { status: 200 }),
      new Response(null, { status: 404 })
    )

    const store = createHttpProjectAudioStore(BASE)
    const fetched = await store.get('abc')
    expect(fetched && new TextDecoder().decode(fetched)).toBe('wav')
    expect(await store.get('nope')).toBeUndefined()
  })

  it('throws on a failing response', async () => {
    stubFetch(new Response(null, { status: 500 }))

    await expect(createHttpProjectAudioStore(BASE).get('abc')).rejects.toThrow(
      '500'
    )
  })
})
