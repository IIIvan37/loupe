import type {
  AudioRef,
  Project,
  ProjectAudioStore,
  ProjectStore
} from '@app/core'

/**
 * HTTP adapters for the core's `ProjectStore` / `ProjectAudioStore` ports,
 * against the local loupe server (`server/app/projects.py`).
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

/** The server refs blobs by their sha256 — computing it locally lets a save
 * skip re-uploading unchanged audio (stems especially: hundreds of MB). */
async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('')
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
      const response = await ensureOk(
        await fetch(`${baseUrl}/audio`, { method: 'POST', body: bytes })
      )
      // The server's ref is the source of truth; it matches the local hash
      // under the shared content-addressing contract.
      const { ref } = (await response.json()) as { ref: AudioRef }
      known.set(localRef, ref)
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
