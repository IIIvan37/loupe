import { type AudioFileDecoder, loadTrack, type Track } from '@app/core'
import { useState } from 'react'
import { createWebAudioDecoder } from '../../audio/web-audio-decoder.ts'

/** Peak resolution: more buckets than screen pixels, so it stays crisp at 1×. */
const BUCKET_COUNT = 1200

export type TrackImportState =
  | { readonly status: 'idle' }
  | { readonly status: 'loading' }
  | { readonly status: 'loaded'; readonly track: Track }
  | { readonly status: 'error'; readonly message: string }

export interface TrackImport {
  readonly state: TrackImportState
  readonly importFile: (file: File) => Promise<void>
}

/**
 * Smart hook (= driving adapter logic): turns a picked file into bytes, runs the
 * `loadTrack` use-case with the decoder port, and exposes the resulting state.
 * The decoder defaults to the real Web Audio adapter and is injected in tests.
 */
export function useTrackImport(decoder?: AudioFileDecoder): TrackImport {
  const [state, setState] = useState<TrackImportState>({ status: 'idle' })

  async function importFile(file: File): Promise<void> {
    setState({ status: 'loading' })
    try {
      const bytes = await file.arrayBuffer()
      const port = decoder ?? createWebAudioDecoder()
      const result = await loadTrack(
        { bytes, bucketCount: BUCKET_COUNT },
        { decoder: port }
      )
      setState(
        result.ok
          ? { status: 'loaded', track: result.track }
          : { status: 'error', message: result.error }
      )
    } catch (e) {
      // Reading the file (or constructing the audio context) can still reject —
      // surface it instead of leaving a spinner stuck forever.
      setState({
        status: 'error',
        message: e instanceof Error ? e.message : String(e)
      })
    }
  }

  return { state, importFile }
}
