import {
  type AudioRef,
  type Project,
  type ProjectAudioStore,
  ProjectError,
  type ProjectStore,
  parseProject
} from '@app/core'
import { sha256Hex } from './content-hash.ts'
import { readableProjects, unreadableManifestError } from './manifest-decode.ts'

/**
 * HTTP adapters for the core's `ProjectStore` / `ProjectAudioStore` ports,
 * against the local loupe server (`crates/loupe-server/src/project_store.rs`).
 * Manifests travel as JSON; audio blobs as raw bytes with server-minted,
 * content-addressed refs (same bytes → same ref). Failures throw the typed
 * `ProjectError` (AV.2) — `network` when fetch itself dies, `server` on a
 * non-OK answer — which the project use-cases fold into an error `Result`.
 */

/** Run a fetch, naming a dead transport: only the fetch call gets the network
 * typing — a `TypeError` thrown elsewhere must not read as « unreachable ». */
async function fetched(run: () => Promise<Response>): Promise<Response> {
  try {
    return await run()
  } catch (e) {
    if (e instanceof TypeError) {
      throw new ProjectError('network', e.message)
    }
    throw e
  }
}

function ensureOk(response: Response): Response {
  if (!response.ok) {
    throw new ProjectError(
      'server',
      `project server answered ${response.status}`
    )
  }
  return response
}

export function createHttpProjectStore(baseUrl: string): ProjectStore {
  return {
    async list(): Promise<readonly Project[]> {
      const response = ensureOk(
        await fetched(() => fetch(`${baseUrl}/projects`))
      )
      const manifests: unknown = await response.json()
      if (!Array.isArray(manifests)) {
        throw new ProjectError(
          'unreadable',
          'project server answered with a non-list'
        )
      }
      // The server persists manifests verbatim (AA.2): decode at the edge and
      // hide the broken ones from the list rather than crash the dialog.
      return readableProjects(manifests)
    },
    async load(id: string): Promise<Project | undefined> {
      const response = await fetched(() => fetch(`${baseUrl}/projects/${id}`))
      if (response.status === 404) {
        return undefined
      }
      const project = parseProject(await ensureOk(response).json())
      if (project === undefined) {
        throw unreadableManifestError(id)
      }
      return project
    },
    async save(project: Project): Promise<void> {
      ensureOk(
        await fetched(() =>
          fetch(`${baseUrl}/projects/${project.id}`, {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(project)
          })
        )
      )
    },
    async delete(id: string): Promise<void> {
      const response = await fetched(() =>
        fetch(`${baseUrl}/projects/${id}`, { method: 'DELETE' })
      )
      // The port promises « deleting an unknown id is a no-op »: the local
      // Rust server answers an idempotent 2xx, but a variant answering 404
      // means the same thing — nothing left to delete.
      if (response.status !== 404) {
        ensureOk(response)
      }
    }
  }
}

export function createHttpProjectAudioStore(
  baseUrl: string
): ProjectAudioStore {
  // Local hash → ref the server answered with, for blobs already uploaded or
  // probed — a re-save of the same session skips even the existence probe.
  const known = new Map<string, AudioRef>()

  async function existsOnServer(ref: AudioRef): Promise<boolean> {
    try {
      const response = await fetch(`${baseUrl}/audio/${ref}`, {
        method: 'HEAD'
      })
      return response.ok
    } catch {
      // Probe failed (older server, network blip) — fall back to uploading.
      return false
    }
  }

  return {
    async put(bytes: ArrayBuffer): Promise<AudioRef> {
      const localRef = await sha256Hex(bytes)
      const cached = known.get(localRef)
      if (cached !== undefined) {
        return cached
      }
      if (await existsOnServer(localRef)) {
        known.set(localRef, localRef)
        return localRef
      }
      const response = ensureOk(
        await fetched(() =>
          fetch(`${baseUrl}/audio`, { method: 'POST', body: bytes })
        )
      )
      // The server's ref is the source of truth; it matches the local hash
      // under the shared content-addressing contract.
      const { ref } = (await response.json()) as { ref: AudioRef }
      known.set(localRef, ref)
      return ref
    },
    async get(ref: AudioRef): Promise<ArrayBuffer | undefined> {
      const response = await fetched(() => fetch(`${baseUrl}/audio/${ref}`))
      if (response.status === 404) {
        return undefined
      }
      return ensureOk(response).arrayBuffer()
    }
  }
}
