import type { ProjectFs } from './fs-project-store.ts'

/**
 * An in-memory `ProjectFs` for the store specs: a flat path→content map plus a
 * write/rename log so atomicity (temp file then rename) can be asserted. Not a
 * parity harness — the real filesystem semantics live behind the Tauri binding.
 */
export function memoryProjectFs() {
  const files = new Map<string, string | Uint8Array>()
  const log: string[] = []
  const fileAt = (path: string) => {
    const file = files.get(path)
    if (file === undefined) {
      throw new Error(`no such file: ${path}`)
    }
    return file
  }
  const fs: ProjectFs = {
    async mkdir() {},
    async readDir(dir: string) {
      const names: string[] = []
      for (const path of files.keys()) {
        const name = path.slice(dir.length + 1)
        if (path.startsWith(`${dir}/`) && !name.includes('/')) {
          names.push(name)
        }
      }
      return names
    },
    async readTextFile(path: string) {
      return String(fileAt(path))
    },
    async writeTextFile(path: string, text: string) {
      log.push(`write ${path}`)
      files.set(path, text)
    },
    async readFile(path: string) {
      const file = fileAt(path)
      return typeof file === 'string' ? new TextEncoder().encode(file) : file
    },
    async writeFile(path: string, bytes: Uint8Array) {
      log.push(`write ${path}`)
      files.set(path, bytes)
    },
    async rename(from: string, to: string) {
      log.push(`rename ${from} -> ${to}`)
      files.set(to, fileAt(from))
      files.delete(from)
    },
    async remove(path: string) {
      files.delete(path)
    },
    async exists(path: string) {
      return files.has(path)
    }
  }
  return { fs, files, log }
}
