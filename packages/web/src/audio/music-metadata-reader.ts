import type { TrackMetadataReader } from '@app/core'
import { parseBuffer } from 'music-metadata'

/**
 * `TrackMetadataReader` backed by music-metadata: reads embedded tags (ID3,
 * MP4/iTunes, Vorbis, …) from the raw bytes. Best-effort by contract — the
 * caller treats a rejection as "no tags", so format sniffing failures are fine.
 */
export function createMusicMetadataReader(): TrackMetadataReader {
  return {
    read: async (bytes) => {
      const { common } = await parseBuffer(new Uint8Array(bytes))
      return { title: common.title, artist: common.artist }
    }
  }
}
