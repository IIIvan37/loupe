import type { AudioRef, Project } from '../domain/project.ts'

/**
 * Why a project operation failed (AV.2, the detections' standard): the code
 * drives the translated copy, the raw detail goes to the console. Transport
 * codes (`network`, `server`, `unreadable`) come from the store adapters via
 * `ProjectError`; the rest name the use-cases' own refusals.
 */
export type ProjectErrorCode =
  | 'network'
  | 'server'
  | 'unreadable'
  | 'not-found'
  | 'empty-name'
  | 'mixer-mismatch'
  | 'missing-audio'
  | 'unknown'

/** The typed failure a store adapter (or the use-case itself) raises when it
 * can name the cause; anything untyped folds into `unknown`, detail intact. */
export class ProjectError extends Error {
  readonly code: Exclude<ProjectErrorCode, 'unknown'>

  constructor(code: Exclude<ProjectErrorCode, 'unknown'>, detail: string) {
    super(detail)
    this.code = code
    this.name = 'ProjectError'
  }
}

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
