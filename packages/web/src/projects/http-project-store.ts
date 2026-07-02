import type {
  AudioRef,
  Project,
  ProjectAudioStore,
  ProjectStore
} from '@app/core'

/**
 * HTTP adapters for the core's `ProjectStore` / `ProjectAudioStore` ports,
 * against the local loupe server (`separator-server/app/projects.py`).
 * Manifests travel as JSON; audio blobs as raw bytes with server-minted,
 * content-addressed refs (same bytes → same ref). A non-OK response throws —
 * the project use-cases turn that into an error `Result`.
 */

async function ensureOk(response: Response): Promise<Response> {
  if (!response.ok) {
    throw new Error(`project server answered ${response.status}`)
  }
  return response
}

export function createHttpProjectStore(baseUrl: string): ProjectStore {
  return {
    async list(): Promise<readonly Project[]> {
      const response = await ensureOk(await fetch(`${baseUrl}/projects`))
      return (await response.json()) as Project[]
    },
    async load(id: string): Promise<Project | undefined> {
      const response = await fetch(`${baseUrl}/projects/${id}`)
      if (response.status === 404) {
        return undefined
      }
      return (await (await ensureOk(response)).json()) as Project
    },
    async save(project: Project): Promise<void> {
      await ensureOk(
        await fetch(`${baseUrl}/projects/${project.id}`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(project)
        })
      )
    },
    async delete(id: string): Promise<void> {
      await ensureOk(
        await fetch(`${baseUrl}/projects/${id}`, { method: 'DELETE' })
      )
    }
  }
}

export function createHttpProjectAudioStore(
  baseUrl: string
): ProjectAudioStore {
  return {
    async put(bytes: ArrayBuffer): Promise<AudioRef> {
      const response = await ensureOk(
        await fetch(`${baseUrl}/audio`, { method: 'POST', body: bytes })
      )
      const { ref } = (await response.json()) as { ref: AudioRef }
      return ref
    },
    async get(ref: AudioRef): Promise<ArrayBuffer | undefined> {
      const response = await fetch(`${baseUrl}/audio/${ref}`)
      if (response.status === 404) {
        return undefined
      }
      return (await ensureOk(response)).arrayBuffer()
    }
  }
}
