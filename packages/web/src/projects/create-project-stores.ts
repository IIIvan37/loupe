import type { ProjectDeps } from '@app/core'
import { isServerShell } from '../lib/server-shell.ts'
import {
  createHttpProjectAudioStore,
  createHttpProjectStore
} from './http-project-store.ts'

/**
 * Build the project persistence adapters (`ProjectStore` + `ProjectAudioStore`).
 * In the server shell (distribution D1) the page is served by the local loupe
 * server and the HTTP stores talk to their own origin
 * (`crates/loupe-server`). In the plain browser there is no backend: the
 * project UI is hidden and these stores are an empty null-object so the hooks
 * stay inert (list is empty, nothing persists).
 */
export function createProjectStores(): ProjectDeps {
  if (isServerShell()) {
    const origin = window.location.origin
    return {
      store: createHttpProjectStore(origin),
      audio: createHttpProjectAudioStore(origin)
    }
  }
  return emptyProjectStores()
}

/** The browser's no-op persistence: no project UI is shown there, so nothing
 * ever calls these — they only keep the project hooks constructible. */
function emptyProjectStores(): ProjectDeps {
  return {
    store: {
      list: async () => [],
      load: async () => undefined,
      save: async () => {},
      delete: async () => {}
    },
    audio: {
      put: async () => {
        throw new Error('Saving projects needs the local loupe server.')
      },
      get: async () => undefined
    }
  }
}
