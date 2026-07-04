import {
  type DownloadProgress,
  importFromUrl,
  type TrackSource,
  type TrackSourceMetadata
} from '@app/core'
import { useMemo, useRef, useState } from 'react'
import { createTrackSource } from '../../audio/create-track-source.ts'

/** What the header needs to drive the URL-import surface. */
export interface UrlImport {
  /** Live download progress while a fetch runs, else undefined. */
  readonly progress: DownloadProgress | undefined
  /** The last failure, until dismissed or a new run starts. */
  readonly error: string | undefined
  /** Whether a download is in flight — the field and submit lock. */
  readonly running: boolean
  /** Start importing the given URL; a no-op while one is already running. */
  readonly submit: (url: string) => void
  readonly dismissError: () => void
}

/**
 * Smart hook owning the URL-import lifecycle: it drives the `importFromUrl`
 * use-case through the HTTP `TrackSource`, streams download progress into local
 * state, and hands the decoded-ready bytes + metadata to `onImported` (the
 * session takes it from there, exactly as a picked file). A run-id guard drops a
 * superseded run so a slow download can't land on a track the user has moved on
 * from. The `source` is injectable for tests.
 */
export function useImportFromUrl(
  onImported: (bytes: ArrayBuffer, metadata: TrackSourceMetadata) => void,
  source?: TrackSource
): UrlImport {
  const trackSource = useMemo(() => source ?? createTrackSource(), [source])
  const [progress, setProgress] = useState<DownloadProgress | undefined>(
    undefined
  )
  const [error, setError] = useState<string | undefined>(undefined)
  const [running, setRunning] = useState(false)
  const runIdRef = useRef(0)

  function submit(url: string): void {
    if (running) {
      return
    }
    const runId = ++runIdRef.current
    setRunning(true)
    setError(undefined)
    setProgress({ phase: 'downloading', fraction: 0 })
    void importFromUrl(
      { url },
      {
        source: trackSource,
        onProgress: (update) => {
          // Ignore a superseded run's late progress.
          if (runIdRef.current === runId) {
            setProgress(update)
          }
        }
      }
    ).then((result) => {
      // A newer run took over while this one was downloading — discard it.
      if (runIdRef.current !== runId) {
        return
      }
      setRunning(false)
      setProgress(undefined)
      if (result.ok) {
        onImported(result.bytes, result.metadata)
      } else {
        setError(result.error)
      }
    })
  }

  return {
    progress,
    error,
    running,
    submit,
    dismissError: () => setError(undefined)
  }
}
