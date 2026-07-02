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

export interface Projects {
  /** The saved projects, most recently updated first. */
  readonly projects: readonly Project[]
  /** The id of the open/last-saved project — what a re-save updates in place. */
  readonly currentId: string | undefined
  /** The last operation's failure, or undefined once one succeeds. */
  readonly error: string | undefined
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
 * their light UI state — the listing, the current project's id and the last
 * error. Identity and the clock are minted here, outside the pure core. The
 * stores default to the local-server HTTP adapters and are injected in tests.
 */
export function useProjects(stores?: ProjectDeps): Projects {
  const deps = useMemo(() => stores ?? createProjectStores(), [stores])
  const [projects, setProjects] = useState<readonly Project[]>([])
  const [currentId, setCurrentId] = useState<string | undefined>(undefined)
  const [error, setError] = useState<string | undefined>(undefined)

  async function refresh(): Promise<void> {
    const result = await listProjects({ store: deps.store })
    if (result.ok) {
      setProjects(result.projects)
      setError(undefined)
    } else {
      setError(result.error)
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
    const result = await saveProject({ ...input, stamp }, deps)
    if (result.ok) {
      setCurrentId(result.project.id)
      setError(undefined)
      await refresh()
    } else {
      setError(result.error)
    }
  }

  async function open(id: string): Promise<OpenProjectResult> {
    const result = await openProject({ id }, deps)
    if (result.ok) {
      setCurrentId(id)
      setError(undefined)
    } else {
      setError(result.error)
    }
    return result
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
      setError(result.error)
    }
  }

  return { projects, currentId, error, refresh, save, open, remove }
}
