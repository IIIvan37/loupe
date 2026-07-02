import type { LoopLibrary } from '../domain/loop-library.ts'
import type { MarkerList } from '../domain/marker-list.ts'
import type { MixerState } from '../domain/mixer.ts'
import {
  mixerMatchesStems,
  type Project,
  type ProjectStamp,
  type ProjectStem,
  projectFromSession
} from '../domain/project.ts'
import { errorMessage } from './error-message.ts'
import type { ProjectAudioStore, ProjectStore } from './ports.ts'

export interface ProjectDeps {
  readonly store: ProjectStore
  readonly audio: ProjectAudioStore
}

/** A stem as it leaves the session: identity plus its encoded WAV bytes. */
export interface SaveProjectStem {
  readonly id: string
  readonly label: string
  readonly bytes: ArrayBuffer
}

/**
 * Everything a save needs: the session's data with the heavy audio still as
 * bytes (the use-case stores them and keeps only refs), plus the caller-minted
 * stamp — id, name and clock stay outside the core.
 */
export interface SaveProjectInput {
  readonly stamp: ProjectStamp
  readonly source: {
    readonly title: string | undefined
    readonly artist: string | undefined
    readonly bytes: ArrayBuffer
  }
  readonly loops: LoopLibrary
  readonly markers: MarkerList
  readonly separation?: {
    readonly stems: readonly SaveProjectStem[]
    readonly mixer: MixerState
  }
}

export type SaveProjectResult =
  | { readonly ok: true; readonly project: Project }
  | { readonly ok: false; readonly error: string }

/**
 * Persist the current session as a project: store the heavy audio (source +
 * stems) behind refs, assemble the light `Project` around them, and save the
 * manifest. An inconsistent separation (mixer channels ≠ stems) is rejected
 * before any byte is stored. Saving over an existing id is an update —
 * `createdAt` survives, `updatedAt` becomes `stamp.now`. Expected failures
 * (full disk, unreachable store) are a `Result`, not an exception.
 */
export async function saveProject(
  input: SaveProjectInput,
  deps: ProjectDeps
): Promise<SaveProjectResult> {
  const separation = input.separation
  if (
    separation !== undefined &&
    !mixerMatchesStems(
      separation.stems.map((stem) => stem.id),
      separation.mixer
    )
  ) {
    return { ok: false, error: 'Mixer channels do not match the stems' }
  }
  try {
    const [sourceRef, stems, existing] = await Promise.all([
      deps.audio.put(input.source.bytes),
      separation === undefined
        ? undefined
        : storeStems(separation.stems, deps.audio),
      deps.store.load(input.stamp.id)
    ])
    const fresh = projectFromSession(
      {
        source: {
          title: input.source.title,
          artist: input.source.artist,
          audioRef: sourceRef
        },
        loops: input.loops,
        markers: input.markers,
        ...(separation === undefined || stems === undefined
          ? {}
          : { separation: { stems, mixer: separation.mixer } })
      },
      input.stamp
    )
    const project =
      existing === undefined
        ? fresh
        : { ...fresh, createdAt: existing.createdAt }
    await deps.store.save(project)
    return { ok: true, project }
  } catch (e) {
    return { ok: false, error: errorMessage(e) }
  }
}

export type ListProjectsResult =
  | { readonly ok: true; readonly projects: readonly Project[] }
  | { readonly ok: false; readonly error: string }

/** List the saved projects, most recently updated first. */
export async function listProjects(deps: {
  readonly store: ProjectStore
}): Promise<ListProjectsResult> {
  try {
    const projects = (await deps.store.list()).toSorted(
      (a, b) => b.updatedAt - a.updatedAt
    )
    return { ok: true, projects }
  } catch (e) {
    return { ok: false, error: errorMessage(e) }
  }
}

/** One stem's bytes as resolved on open, keyed like its `ProjectStem`. */
export interface OpenedStem {
  readonly id: string
  readonly bytes: ArrayBuffer
}

export type OpenProjectResult =
  | {
      readonly ok: true
      readonly project: Project
      readonly sourceBytes: ArrayBuffer
      readonly stems: readonly OpenedStem[]
    }
  | { readonly ok: false; readonly error: string }

/**
 * Load a project manifest and resolve every `AudioRef` back to bytes — the
 * original file plus each stem's WAV — so the caller can rebuild the working
 * session. An unknown id or a dangling ref is an error `Result`.
 */
export async function openProject(
  input: { readonly id: string },
  deps: ProjectDeps
): Promise<OpenProjectResult> {
  try {
    const project = await deps.store.load(input.id)
    if (project === undefined) {
      return { ok: false, error: `Unknown project "${input.id}"` }
    }
    const [sourceBytes, stems] = await Promise.all([
      fetchAudio(project.source.audioRef, deps.audio),
      Promise.all(
        (project.separation?.stems ?? []).map(async (stem) => ({
          id: stem.id,
          bytes: await fetchAudio(stem.audioRef, deps.audio)
        }))
      )
    ])
    return { ok: true, project, sourceBytes, stems }
  } catch (e) {
    return { ok: false, error: errorMessage(e) }
  }
}

export type DeleteProjectResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: string }

/**
 * Remove a project's manifest. Its audio blobs become unreachable; reclaiming
 * them is the audio store adapter's business (a later GC), not the core's.
 */
export async function deleteProject(
  input: { readonly id: string },
  deps: { readonly store: ProjectStore }
): Promise<DeleteProjectResult> {
  try {
    await deps.store.delete(input.id)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: errorMessage(e) }
  }
}

function storeStems(
  stems: readonly SaveProjectStem[],
  audio: ProjectAudioStore
): Promise<readonly ProjectStem[]> {
  return Promise.all(
    stems.map(async (stem) => ({
      id: stem.id,
      label: stem.label,
      audioRef: await audio.put(stem.bytes)
    }))
  )
}

async function fetchAudio(
  ref: string,
  audio: ProjectAudioStore
): Promise<ArrayBuffer> {
  const bytes = await audio.get(ref)
  if (bytes === undefined) {
    throw new Error(`Missing audio for ref "${ref}"`)
  }
  return bytes
}
