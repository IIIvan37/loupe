import {
  type AudioRef,
  type Project,
  type ProjectAudioStore,
  type ProjectStore,
  parseProject
} from '@app/core'
import { toArrayBuffer } from '../lib/to-array-buffer.ts'
import { sha256Hex } from './content-hash.ts'
import { readableProjects, unreadableManifestError } from './manifest-decode.ts'

/**
 * Filesystem adapters for the core's `ProjectStore` / `ProjectAudioStore`
 * ports — the desktop (Tauri) twin of the HTTP adapters, at contract parity
 * with `server/app/projects.py`: manifests as `projects/{id}.json`, blobs
 * content-addressed as `audio/{sha256}`, every write atomic (temp file +
 * rename), a conservative manifest-scan GC, and path-hostile ids/refs stopped
 * by the same patterns the server uses. Paths are relative; the injected
 * `ProjectFs` anchors them (the Tauri binding under the app-data directory,
 * an in-memory fake in tests).
 */

/** The slice of a filesystem the adapters need. All paths are relative. */
export interface ProjectFs {
  /** Create `dir` (and parents) if missing; existing is not an error. */
  mkdir(dir: string): Promise<void>
  /** File names (not paths) directly inside `dir`; missing dir may throw. */
  readDir(dir: string): Promise<readonly string[]>
  readTextFile(path: string): Promise<string>
  writeTextFile(path: string, text: string): Promise<void>
  readFile(path: string): Promise<Uint8Array>
  writeFile(path: string, bytes: Uint8Array): Promise<void>
  /** Atomically replace `to` with `from` (POSIX rename semantics). */
  rename(from: string, to: string): Promise<void>
  remove(path: string): Promise<void>
  exists(path: string): Promise<boolean>
}

const PROJECTS_DIR = 'projects'
const AUDIO_DIR = 'audio'

// The server's own gates (`server/app/projects.py`): what may name a file.
const REF_PATTERN = /^[0-9a-f]{64}$/
const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/

function manifestPath(id: string): string {
  return `${PROJECTS_DIR}/${id}.json`
}

function audioPath(ref: string): string {
  return `${AUDIO_DIR}/${ref}`
}

/** Write-then-rename: readers never see a half-written file. */
async function writeAtomically(
  fs: ProjectFs,
  path: string,
  write: (tmpPath: string) => Promise<void>
): Promise<void> {
  await write(`${path}.tmp`)
  await fs.rename(`${path}.tmp`, path)
}

/** Memoise the directory creation: one IPC round-trip per store, not per op
 * (a failed attempt is retried on the next op, not cached). */
function dirEnsurer(fs: ProjectFs, dir: string): () => Promise<void> {
  let ensured: Promise<void> | undefined
  return () => {
    ensured ??= fs.mkdir(dir).catch((e) => {
      ensured = undefined
      throw e
    })
    return ensured
  }
}

function parseManifestText(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

export function createFsProjectStore(fs: ProjectFs): ProjectStore {
  const ensureDir = dirEnsurer(fs, PROJECTS_DIR)
  return {
    async list(): Promise<readonly Project[]> {
      await ensureDir()
      const names = await fs.readDir(PROJECTS_DIR)
      // Per-file failure containment: a manifest that vanished between
      // readDir and read (a delete from another window), or one that is
      // corrupt or hand-broken, hides from the list — the server skips
      // unparseable JSON the same way. It never breaks the others.
      const manifests = await Promise.all(
        names.flatMap((name) =>
          name.endsWith('.json')
            ? [
                fs
                  .readTextFile(`${PROJECTS_DIR}/${name}`)
                  .then(parseManifestText, () => undefined)
              ]
            : []
        )
      )
      return readableProjects(manifests)
    },
    async load(id: string): Promise<Project | undefined> {
      if (!ID_PATTERN.test(id) || !(await fs.exists(manifestPath(id)))) {
        return undefined
      }
      const project = parseProject(
        parseManifestText(await fs.readTextFile(manifestPath(id)))
      )
      if (project === undefined) {
        // Distinct from « unknown »: the file exists but cannot be trusted —
        // surfaced to the UI as an error, not as a silently missing project.
        throw unreadableManifestError(id)
      }
      return project
    },
    async save(project: Project): Promise<void> {
      if (!ID_PATTERN.test(project.id)) {
        throw new Error(`Invalid project id "${project.id}"`)
      }
      await ensureDir()
      await writeAtomically(fs, manifestPath(project.id), (tmp) =>
        fs.writeTextFile(tmp, JSON.stringify(project))
      )
    },
    async delete(id: string): Promise<void> {
      if (!ID_PATTERN.test(id)) {
        throw new Error(`Invalid project id "${id}"`)
      }
      if (await fs.exists(manifestPath(id))) {
        await fs.remove(manifestPath(id))
      }
    }
  }
}

export function createFsProjectAudioStore(fs: ProjectFs): ProjectAudioStore {
  const ensureDir = dirEnsurer(fs, AUDIO_DIR)
  return {
    async put(bytes: ArrayBuffer): Promise<AudioRef> {
      const ref = await sha256Hex(bytes)
      if (!(await fs.exists(audioPath(ref)))) {
        // Same bytes → same file: an existing blob makes the write a no-op.
        await ensureDir()
        await writeAtomically(fs, audioPath(ref), (tmp) =>
          fs.writeFile(tmp, new Uint8Array(bytes))
        )
      }
      return ref
    },
    async get(ref: AudioRef): Promise<ArrayBuffer | undefined> {
      if (!REF_PATTERN.test(ref) || !(await fs.exists(audioPath(ref)))) {
        return undefined
      }
      return toArrayBuffer(await fs.readFile(audioPath(ref)))
    }
  }
}

export interface FsGarbageReport {
  readonly deleted: number
  readonly kept: number
  /** True when an unparseable manifest made the sweep abort untouched. */
  readonly skipped: boolean
}

/** Every string in a JSON tree that spells like a ref — nothing else in a
 * manifest is a 64-char hex string, so there are no false positives. */
function collectRefs(value: unknown, into: Set<string>): void {
  if (typeof value === 'string') {
    if (REF_PATTERN.test(value)) {
      into.add(value)
    }
    return
  }
  if (typeof value === 'object' && value !== null) {
    for (const child of Object.values(value)) {
      collectRefs(child, into)
    }
  }
}

/**
 * Delete audio blobs no manifest references — the mirror of the server's
 * `collect_garbage`. Conservative: if any manifest fails to parse as JSON,
 * nothing is deleted (a broken manifest must not turn into deleted audio);
 * only bare-sha256-named files are candidates, so temp files and strays are
 * never touched. Runs at desktop startup, like the server's lifespan GC.
 */
export async function collectFsGarbage(
  fs: ProjectFs
): Promise<FsGarbageReport> {
  await Promise.all([fs.mkdir(PROJECTS_DIR), fs.mkdir(AUDIO_DIR)])
  const live = new Set<string>()
  const manifestTexts = await Promise.all(
    (await fs.readDir(PROJECTS_DIR)).flatMap((name) =>
      name.endsWith('.json')
        ? [fs.readTextFile(`${PROJECTS_DIR}/${name}`).catch(() => undefined)]
        : []
    )
  )
  for (const text of manifestTexts) {
    try {
      // A failed read is as disqualifying as broken JSON: refs may be missing.
      collectRefs(JSON.parse(text as string), live)
    } catch {
      return { deleted: 0, kept: 0, skipped: true }
    }
  }
  const blobs = (await fs.readDir(AUDIO_DIR)).filter((name) =>
    REF_PATTERN.test(name)
  )
  const orphans = blobs.filter((name) => !live.has(name))
  await Promise.all(orphans.map((name) => fs.remove(audioPath(name))))
  return {
    deleted: orphans.length,
    kept: blobs.length - orphans.length,
    skipped: false
  }
}
