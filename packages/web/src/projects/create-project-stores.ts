import type { ProjectDeps } from '@app/core'
import {
  createHttpProjectAudioStore,
  createHttpProjectStore
} from './http-project-store.ts'
import { SERVER_URL } from './server-url.ts'

/**
 * Build the project persistence adapters (`ProjectStore` + `ProjectAudioStore`)
 * against the local server — the same FastAPI backend the separator runs on,
 * pointed at with `VITE_SEPARATOR_URL` (defaults to `http://localhost:8000`).
 */
export function createProjectStores(): ProjectDeps {
  return {
    store: createHttpProjectStore(SERVER_URL),
    audio: createHttpProjectAudioStore(SERVER_URL)
  }
}
