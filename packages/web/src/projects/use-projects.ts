import {
  deleteProject,
  listProjects,
  type OpenProjectResult,
  openProject,
  type Project,
  type ProjectDeps,
  type SaveProjectInput,
  saveProject
} from '@app/core'
import { useMemo, useState } from 'react'
import { createProjectStores } from './create-project-stores.ts'

/** The operation currently in flight, driving the busy affordances. */
export type ProjectsBusy = 'save' | 'open' | null

export interface Projects {
  /** The saved projects, most recently updated first. */
  readonly projects: readonly Project[]
  /** The id of the open/last-saved project — what a re-save updates in place. */
  readonly currentId: string | undefined
  /** The last operation's failure (already worded for the user), or undefined. */
  readonly error: string | undefined
  /** Whether the last listing failed — the server is unreachable. */
  readonly listError: boolean
  readonly busy: ProjectsBusy
  readonly dismissError: () => void
  readonly refresh: () => Promise<void>
  /** Save the session under a name; a fresh id is minted when none is current. */
  readonly save: (
    name: string,
    input: Omit<SaveProjectInput, 'stamp'>
  ) => Promise<void>
  /** Open a project; the caller rebuilds the session from the result. */
  readonly open: (id: string) => Promise<OpenProjectResult>
  readonly remove: (id: string) => Promise<void>
}

/**
 * Smart hook (= driving adapter logic): runs the project use-cases and holds
 * their light UI state — the listing, the current project's id, the operation
 * in flight and the last error (prefixed per operation, ready to display).
 * Identity and the clock are minted here, outside the pure core. The stores
 * default to the local-server HTTP adapters and are injected in tests.
 */
export function useProjects(stores?: ProjectDeps): Projects {
  const deps = useMemo(() => stores ?? createProjectStores(), [stores])
  const [projects, setProjects] = useState<readonly Project[]>([])
  const [currentId, setCurrentId] = useState<string | undefined>(undefined)
  const [error, setError] = useState<string | undefined>(undefined)
  const [listError, setListError] = useState(false)
  const [busy, setBusy] = useState<ProjectsBusy>(null)

  async function refresh(): Promise<void> {
    const result = await listProjects({ store: deps.store })
    if (result.ok) {
      setProjects(result.projects)
      setListError(false)
    } else {
      setListError(true)
    }
  }

  async function save(
    name: string,
    input: Omit<SaveProjectInput, 'stamp'>
  ): Promise<void> {
    const stamp = {
      id: currentId ?? crypto.randomUUID(),
      name,
      now: Date.now()
    }
    setBusy('save')
    try {
      const result = await saveProject({ ...input, stamp }, deps)
      if (result.ok) {
        setCurrentId(result.project.id)
        setError(undefined)
        await refresh()
      } else {
        setError(`Impossible d'enregistrer le projet : ${result.error}`)
      }
    } finally {
      setBusy(null)
    }
  }

  async function open(id: string): Promise<OpenProjectResult> {
    setBusy('open')
    try {
      const result = await openProject({ id }, deps)
      if (result.ok) {
        setCurrentId(id)
        setError(undefined)
      } else {
        setError(`Impossible d'ouvrir le projet : ${result.error}`)
      }
      return result
    } finally {
      setBusy(null)
    }
  }

  async function remove(id: string): Promise<void> {
    const result = await deleteProject({ id }, { store: deps.store })
    if (result.ok) {
      if (id === currentId) {
        // The open session no longer maps to a saved project — the next save
        // mints a fresh one instead of resurrecting the deleted id.
        setCurrentId(undefined)
      }
      setError(undefined)
      await refresh()
    } else {
      setError(`Impossible de supprimer le projet : ${result.error}`)
    }
  }

  return {
    projects,
    currentId,
    error,
    listError,
    busy,
    dismissError: () => setError(undefined),
    refresh,
    save,
    open,
    remove
  }
}
