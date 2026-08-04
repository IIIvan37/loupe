import { type Project, ProjectError } from '@app/core'
import { projectStoreContract } from '@app/core/testing'
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

  it('treats a 404 on delete as the promised no-op', async () => {
    // The port promises « deleting an unknown id is a no-op ». The local Rust
    // server happens to answer an idempotent 2xx, but the adapter must honour
    // the obligation itself — a server variant answering 404 is still a no-op.
    stubFetch(new Response(null, { status: 404 }))

    await expect(
      createHttpProjectStore(BASE).delete('never-saved')
    ).resolves.toBeUndefined()
  })

  it('throws the typed « server » error on a failing response', async () => {
    stubFetch(new Response(null, { status: 500 }))

    const failure = await createHttpProjectStore(BASE)
      .list()
      .then(
        () => undefined,
        (e: unknown) => e
      )

    expect(failure).toBeInstanceOf(ProjectError)
    expect((failure as ProjectError).code).toBe('server')
    expect((failure as ProjectError).message).toContain('500')
  })

  it('throws the typed « network » error when fetch itself fails', async () => {
    const fetchMock = vi.fn<typeof fetch>()
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'))
    vi.stubGlobal('fetch', fetchMock)

    const failure = await createHttpProjectStore(BASE)
      .save(project)
      .then(
        () => undefined,
        (e: unknown) => e
      )

    expect(failure).toBeInstanceOf(ProjectError)
    expect((failure as ProjectError).code).toBe('network')
  })

  it('skips invalid manifests in the list — the server persists verbatim', async () => {
    // Hiding an unreadable manifest logs a warning by contract — muted here
    // so the suite output stays signal.
    const muted = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    stubFetch(Response.json([project, { id: 'hollow' }]))

    expect(await createHttpProjectStore(BASE).list()).toEqual([project])
    muted.mockRestore()
  })

  it('throws the typed « unreadable » error on JSON that is not a list', async () => {
    stubFetch(Response.json({ projects: [] }))

    const failure = await createHttpProjectStore(BASE)
      .list()
      .then(
        () => undefined,
        (e: unknown) => e
      )

    expect(failure).toBeInstanceOf(ProjectError)
    expect((failure as ProjectError).code).toBe('unreadable')
    expect((failure as ProjectError).message).toContain('non-list')
  })

  it('throws the typed « unreadable » error when a loaded manifest fails validation', async () => {
    stubFetch(Response.json({ id: 'p1', name: 42 }))

    const failure = await createHttpProjectStore(BASE)
      .load('p1')
      .then(
        () => undefined,
        (e: unknown) => e
      )

    expect(failure).toBeInstanceOf(ProjectError)
    expect((failure as ProjectError).code).toBe('unreadable')
    expect((failure as ProjectError).message).toMatch(/unreadable/i)
  })
})

/**
 * A minimal in-memory server honouring the manifest wire protocol
 * (`GET/PUT/DELETE /projects…`, delete idempotent like the Rust store), so the
 * port contract replays against the REAL adapter — the substitutability proof
 * ADR 0002 promises for every implementation, silently lost when the fs
 * adapter died in the Tauri pivot.
 */
function stubProjectServer(): void {
  const manifests = new Map<string, string>()
  const serve: typeof fetch = async (input, init) => {
    const path = String(input).slice(BASE.length)
    const method = init?.method ?? 'GET'
    if (path === '/projects') {
      return Response.json(
        [...manifests.values()].map((body): unknown => JSON.parse(body))
      )
    }
    const id = decodeURIComponent(path.replace('/projects/', ''))
    if (method === 'PUT') {
      manifests.set(id, String(init?.body))
      return new Response(null, { status: 204 })
    }
    if (method === 'DELETE') {
      manifests.delete(id)
      return new Response(null, { status: 204 })
    }
    const body = manifests.get(id)
    return body === undefined
      ? new Response(null, { status: 404 })
      : new Response(body, {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
  }
  vi.stubGlobal('fetch', vi.fn(serve))
}

projectStoreContract('createHttpProjectStore over the wire protocol', () => {
  stubProjectServer()
  return { store: createHttpProjectStore(BASE) }
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
