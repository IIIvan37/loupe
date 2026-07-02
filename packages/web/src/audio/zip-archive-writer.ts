import type { ArchiveWriter } from '@app/core'
import { zipSync } from 'fflate'

/**
 * `ArchiveWriter` adapter: bundle the files into one zip. Entries are STORED
 * (level 0) — the payload is 16-bit PCM WAV, which barely deflates, and storing
 * keeps a multi-hundred-MB export from freezing the UI for seconds.
 */
export function createZipArchiveWriter(): ArchiveWriter {
  return {
    async write(files) {
      const entries: Record<string, [Uint8Array, { level: 0 }]> = {}
      for (const file of files) {
        entries[file.name] = [file.bytes, { level: 0 }]
      }
      // fflate types its output loosely; it always allocates a plain ArrayBuffer.
      return zipSync(entries) as Uint8Array<ArrayBuffer>
    }
  }
}
