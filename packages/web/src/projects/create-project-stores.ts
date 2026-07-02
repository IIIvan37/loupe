import type { ProjectDeps } from '@app/core'
import {
  createHttpProjectAudioStore,
  createHttpProjectStore
} from './http-project-store.ts'

/** Base URL of the local loupe server (same server as the separator). */
const PROJECTS_URL =
  import.meta.env.VITE_SEPARATOR_URL ?? 'http://localhost:8000'

/**
 * Build the project persistence adapters (`ProjectStore` + `ProjectAudioStore`)
 * against the local server — the same FastAPI backend the separator runs on,
 * pointed at with `VITE_SEPARATOR_URL` (defaults to `http://localhost:8000`).
 */
export function createProjectStores(): ProjectDeps {
  return {
    store: createHttpProjectStore(PROJECTS_URL),
    audio: createHttpProjectAudioStore(PROJECTS_URL)
  }
}
