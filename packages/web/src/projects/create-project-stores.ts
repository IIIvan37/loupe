import type { ProjectDeps } from '@app/core'
import { isTauriShell } from '../auth/tauri-env.ts'
import {
  collectFsGarbage,
  createFsProjectAudioStore,
  createFsProjectStore,
  type ProjectFs
} from './fs-project-store.ts'
import { createTauriProjectFs } from './tauri-fs.ts'

// One sweep per app run, like the server's lifespan GC — not one per shell
// mount. Best-effort: a failed sweep never blocks opening a project.
let sweep: Promise<void> | undefined

function startupSweep(fs: ProjectFs): Promise<void> {
  return collectFsGarbage(fs).then(
    (report) => {
      if (report.skipped) {
        console.warn(
          'loupe: audio GC skipped — an unreadable manifest disables deletion'
        )
      }
    },
    (e) => {
      console.warn('loupe: audio GC failed', e)
    }
  )
}

/** Every operation waits for the startup sweep: the server runs its GC in the
 * lifespan hook before serving for the same reason — a blob stored while the
 * sweep is snapshotting live refs would look orphaned and be deleted. */
function afterSweep(fs: ProjectFs, ready: Promise<void>): ProjectFs {
  const gate =
    <Args extends unknown[], Out>(op: (...args: Args) => Promise<Out>) =>
    async (...args: Args): Promise<Out> => {
      await ready
      return op(...args)
    }
  return {
    mkdir: gate(fs.mkdir),
    readDir: gate(fs.readDir),
    readTextFile: gate(fs.readTextFile),
    writeTextFile: gate(fs.writeTextFile),
    readFile: gate(fs.readFile),
    writeFile: gate(fs.writeFile),
    rename: gate(fs.rename),
    remove: gate(fs.remove),
    exists: gate(fs.exists)
  }
}

/**
 * Build the project persistence adapters (`ProjectStore` + `ProjectAudioStore`).
 * Inside the Tauri shell projects live on the local filesystem (T2.2 — « les
 * projets restent locaux ») under the app-data directory. Offload-only
 * (Lot AJ): there is no local server, so **saved projects are desktop-only** —
 * the browser is an analysis-only playground whose project UI is hidden, and
 * these stores are an empty null-object so the hooks stay inert (list is empty,
 * nothing persists).
 */
export function createProjectStores(): ProjectDeps {
  if (isTauriShell()) {
    const fs = createTauriProjectFs()
    sweep ??= startupSweep(fs)
    const gated = afterSweep(fs, sweep)
    return {
      store: createFsProjectStore(gated),
      audio: createFsProjectAudioStore(gated)
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
        throw new Error('Saving projects is desktop-only.')
      },
      get: async () => undefined
    }
  }
}
