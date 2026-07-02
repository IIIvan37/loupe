import type { Project, ProjectDeps } from '@app/core'
import { type ChangeEvent, useRef, useState } from 'react'
import { type Projects, useProjects } from '../../projects/use-projects.ts'
import {
  restoreSession,
  type SessionRestoreDeps,
  sessionSaveInput
} from './project-session.ts'

/** A file name without its extension, the fallback header title. */
function trackTitle(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  return dot > 0 ? fileName.slice(0, dot) : fileName
}

export interface ProjectSessionDeps extends SessionRestoreDeps {
  readonly stores?: ProjectDeps | undefined
  /** The imported file's original bytes — what a save persists as the source. */
  readonly loadedBytes: ArrayBuffer | undefined
  readonly metadata: {
    readonly title: string | undefined
    readonly artist: string | undefined
  }
  readonly stemsReady: boolean
  readonly viewport: { readonly reset: () => void }
  /** Called when an open actually starts restoring — closes the dialog. */
  readonly onRestoreStarted: () => void
}

export interface ProjectSession {
  readonly projects: Projects
  /** The display name of the loaded track (file title or project name). */
  readonly trackName: string | null
  /** The project an open is rebuilding right now, driving the busy row. */
  readonly openingId: string | undefined
  /** The saved project the session maps to — what a re-save overwrites. */
  readonly currentProject: Project | undefined
  readonly handleSave: (name: string) => void
  readonly handleOpen: (id: string) => Promise<void>
  readonly onFilePicked: (event: ChangeEvent<HTMLInputElement>) => void
}

/**
 * Smart hook owning the project ↔ session lifecycle: importing a new file
 * detaches the session from the saved project (a save must mint a fresh one),
 * opening a project rebuilds the whole session, and a stale open that resolves
 * after the user moved on to a new import is discarded instead of clobbering it.
 */
export function useProjectSession(deps: ProjectSessionDeps): ProjectSession {
  const projects = useProjects(deps.stores)
  const [trackName, setTrackName] = useState<string | null>(null)
  const [openingId, setOpeningId] = useState<string | undefined>(undefined)
  // Bumped by every new import; a project open that resolves after the user
  // moved on to a fresh file must not clobber that session (the projects
  // dialog stays dismissible while an open is in flight).
  const sessionEpochRef = useRef(0)

  /**
   * A new track gets a fresh timeline — the old markers don't belong to it,
   * the view should start fully zoomed out, and any prior stems are stale.
   */
  function startFreshTrack(name: string): void {
    deps.markers.clear()
    deps.viewport.reset()
    deps.separation.reset()
    deps.mixer.reset()
    setTrackName(name)
  }

  /** Persist the whole session under a name — bytes, loops, markers, stems. */
  function handleSave(name: string): void {
    if (!deps.loadedBytes) {
      return
    }
    const input = sessionSaveInput({
      bytes: deps.loadedBytes,
      title: deps.metadata.title ?? trackName ?? undefined,
      artist: deps.metadata.artist,
      loops: deps.loops.library,
      markers: deps.markers.markers,
      ...(deps.stemsReady
        ? {
            separation: {
              sources: deps.separation.sources,
              mixer: deps.mixer.state
            }
          }
        : {})
    })
    void projects.save(name, input)
  }

  /** Rebuild the whole session from a saved project. */
  async function handleOpen(id: string): Promise<void> {
    const epoch = sessionEpochRef.current
    setOpeningId(id)
    try {
      const result = await projects.open(id)
      // A new file was imported while the open was in flight — the user moved
      // on; restoring now would silently discard what they just picked.
      if (!result.ok || sessionEpochRef.current !== epoch) {
        return
      }
      deps.onRestoreStarted()
      // Same clean slate as a fresh import, then re-import the stored bytes.
      startFreshTrack(result.project.name)
      await restoreSession(result, deps)
    } finally {
      setOpeningId(undefined)
    }
  }

  function onFilePicked(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0]
    if (file) {
      // Detach: saving the new track must not overwrite the open project.
      sessionEpochRef.current += 1
      projects.detach()
      startFreshTrack(trackTitle(file.name))
      void deps.importFile(file)
    }
    // Clear it so re-picking the same file fires `change` again.
    event.target.value = ''
  }

  return {
    projects,
    trackName,
    openingId,
    currentProject: projects.projects.find((p) => p.id === projects.currentId),
    handleSave,
    handleOpen,
    onFilePicked
  }
}
