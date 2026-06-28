import type { TrackMetadataReader } from '@app/core'
import { parseBuffer } from 'music-metadata'

/**
 * `TrackMetadataReader` backed by music-metadata: reads embedded tags (ID3,
 * MP4/iTunes, Vorbis, …) from the raw bytes. Best-effort by contract — the
 * caller treats a rejection as "no tags", so format sniffing failures are fine.
 */
const NO_TAGS = { title: undefined, artist: undefined }

export function createMusicMetadataReader(): TrackMetadataReader {
  return {
    read: async (bytes) => {
      try {
        const { common } = await parseBuffer(new Uint8Array(bytes))
        return { title: common.title, artist: common.artist }
      } catch {
        // Best-effort by contract: a tagless or unparsable file is not an error.
        return NO_TAGS
      }
    }
  }
}
