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

  it('skips invalid manifests in the list — the server persists verbatim', async () => {
    stubFetch(Response.json([project, { id: 'hollow' }]))

    expect(await createHttpProjectStore(BASE).list()).toEqual([project])
  })

  it('throws when the list endpoint answers JSON that is not a list', async () => {
    stubFetch(Response.json({ projects: [] }))

    await expect(createHttpProjectStore(BASE).list()).rejects.toThrow(
      /non-list/
    )
  })

  it('throws « unreadable » when a loaded manifest fails validation', async () => {
    stubFetch(Response.json({ id: 'p1', name: 42 }))

    await expect(createHttpProjectStore(BASE).load('p1')).rejects.toThrow(
      /unreadable/i
    )
  })
})

describe('createHttpProjectAudioStore', () => {
  const bytes = new TextEncoder().encode('wav').buffer as ArrayBuffer

  it('uploads unknown bytes: the existence probe misses, POST follows', async () => {
    const fetchMock = stubFetch(
      new Response(null, { status: 404 }),
      Response.json({ ref: 'abc' })
    )

    const ref = await createHttpProjectAudioStore(BASE).put(bytes)

    const [probeUrl, probeInit] = fetchMock.mock.calls[0] ?? []
    expect(probeInit?.method).toBe('HEAD')
    expect(String(probeUrl)).toMatch(new RegExp(`${BASE}/audio/[0-9a-f]{64}$`))
    const [url, init] = fetchMock.mock.calls[1] ?? []
    expect(url).toBe(`${BASE}/audio`)
    expect(init?.method).toBe('POST')
    expect(init?.body).toBe(bytes)
    expect(ref).toBe('abc')
  })

  it('skips the upload when the server already has the blob (same hash)', async () => {
    const fetchMock = stubFetch(new Response(null, { status: 200 }))

    const ref = await createHttpProjectAudioStore(BASE).put(bytes)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    // The ref is the locally computed sha256 — the shared addressing contract.
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(`${BASE}/audio/${ref}`)
  })

  it('skips even the probe when the same bytes were already put', async () => {
    const fetchMock = stubFetch(
      new Response(null, { status: 404 }),
      Response.json({ ref: 'abc' })
    )
    const store = createHttpProjectAudioStore(BASE)

    await store.put(bytes)
    const again = await store.put(bytes)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(again).toBe('abc')
  })

  it('falls back to uploading when the probe itself fails (older server)', async () => {
    const fetchMock = vi.fn<typeof fetch>()
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'))
    fetchMock.mockResolvedValueOnce(Response.json({ ref: 'abc' }))
    vi.stubGlobal('fetch', fetchMock)

    const ref = await createHttpProjectAudioStore(BASE).put(bytes)

    expect(fetchMock.mock.calls[1]?.[1]?.method).toBe('POST')
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
