import type { AudioRef, Project } from '../domain/project.ts'

/**
 * Driven port: persist the light project manifests (`Project` — refs, loops,
 * markers, mixer; never audio bytes). Implemented by an adapter (Tauri FS or
 * HTTP server — decided at J3.3); the pure core never knows which. `load`
 * resolves to `undefined` for an unknown id.
 */
export interface ProjectStore {
  list(): Promise<readonly Project[]>
  load(id: string): Promise<Project | undefined>
  save(project: Project): Promise<void>
  delete(id: string): Promise<void>
}

/**
 * Driven port: persist the heavy audio bytes a project only points at. `put`
 * mints the `AudioRef` — its spelling (a path, a key, a URL) is the adapter's
 * business. `get` resolves to `undefined` for an unknown ref.
 *
 * Adapters should content-address refs (same bytes → same ref): a re-save then
 * re-points at the existing blob instead of duplicating it, and blobs orphaned
 * by a failed or superseding save stay collectible by a manifest-scan GC —
 * there is deliberately no `delete` here, so reclamation is the adapter's job.
 */
export interface ProjectAudioStore {
  put(bytes: ArrayBuffer): Promise<AudioRef>
  get(ref: AudioRef): Promise<ArrayBuffer | undefined>
}
