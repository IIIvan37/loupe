import type { ProjectFs } from './fs-project-store.ts'

/**
 * The Tauri binding of `ProjectFs`: relative paths anchored under the app-data
 * directory (`~/Library/Application Support/dev.iiivan.loupe` on macOS) via
 * `@tauri-apps/plugin-fs`. The plugin is loaded lazily so the web bundle never
 * pulls it outside the shell (same pattern as the deep-link auth). A humble
 * binding — every decision (paths, atomicity, validation, GC) lives in the
 * testable `fs-project-store.ts`; this file only forwards.
 */

type FsModule = typeof import('@tauri-apps/plugin-fs')
type AppDataFs = {
  fs: FsModule
  baseDir: import('@tauri-apps/plugin-fs').BaseDirectory
}

let moduleOnce: Promise<AppDataFs> | undefined

/** Resolve the plugin and the app-data base once per run. */
function inAppData(): Promise<AppDataFs> {
  moduleOnce ??= import('@tauri-apps/plugin-fs').then((fs) => ({
    fs,
    baseDir: fs.BaseDirectory.AppData
  }))
  return moduleOnce
}

export function createTauriProjectFs(): ProjectFs {
  return {
    async mkdir(dir: string): Promise<void> {
      const { fs, baseDir } = await inAppData()
      await fs.mkdir(dir, { baseDir, recursive: true })
    },
    async readDir(dir: string): Promise<readonly string[]> {
      const { fs, baseDir } = await inAppData()
      const entries = await fs.readDir(dir, { baseDir })
      return entries.flatMap((entry) => (entry.isFile ? [entry.name] : []))
    },
    async readTextFile(path: string): Promise<string> {
      const { fs, baseDir } = await inAppData()
      return fs.readTextFile(path, { baseDir })
    },
    async writeTextFile(path: string, text: string): Promise<void> {
      const { fs, baseDir } = await inAppData()
      await fs.writeTextFile(path, text, { baseDir })
    },
    async readFile(path: string): Promise<Uint8Array> {
      const { fs, baseDir } = await inAppData()
      return fs.readFile(path, { baseDir })
    },
    async writeFile(path: string, bytes: Uint8Array): Promise<void> {
      const { fs, baseDir } = await inAppData()
      await fs.writeFile(path, bytes, { baseDir })
    },
    async rename(from: string, to: string): Promise<void> {
      const { fs, baseDir } = await inAppData()
      await fs.rename(from, to, {
        oldPathBaseDir: baseDir,
        newPathBaseDir: baseDir
      })
    },
    async remove(path: string): Promise<void> {
      const { fs, baseDir } = await inAppData()
      await fs.remove(path, { baseDir })
    },
    async exists(path: string): Promise<boolean> {
      const { fs, baseDir } = await inAppData()
      return fs.exists(path, { baseDir })
    }
  }
}
