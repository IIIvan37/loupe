import {
  type DownloadProgress,
  type ImportUrlErrorCode,
  importFromUrl,
  type TrackSource,
  type TrackSourceMetadata
} from '@app/core'
import { useMemo, useRef, useState } from 'react'
import { createTrackSource } from '../../audio/create-track-source.ts'
import { useAudioSession } from '../audio-session/audio-session.ts'
import { useOnline } from '../ui/use-online.ts'

/**
 * Download progress as the header renders it: the phase is known from the
 * submit on, the fraction only once the source streams a real tick — the
 * first-use yt-dlp bootstrap can run minutes before any byte moves, and a
 * `0%` posed at submit would dress that wait as measured progress (AS.1).
 */
export interface UrlImportProgress {
  readonly phase: DownloadProgress['phase']
  readonly fraction: number | undefined
}

/** What the header needs to drive the URL-import surface. */
export interface UrlImport {
  /** Live download progress while a fetch runs, else undefined. */
  readonly progress: UrlImportProgress | undefined
  /** The last failure's code, until dismissed or a new run starts — the copy
   * table words it (AV.1); the raw detail went to the console. */
  readonly error: ImportUrlErrorCode | undefined
  /** Whether a download is in flight — the field and submit lock. */
  readonly running: boolean
  /** Offline gate (AV.3): the download needs the network, so the entry
   * fields lock with a hint instead of failing after the fact. */
  readonly offline: boolean
  /** Start importing the given URL; a no-op while one is already running. */
  readonly submit: (url: string) => void
  /** Abort the in-flight download and clear the progress; a no-op when idle. */
  readonly cancel: () => void
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
  const session = useAudioSession()
  const injected = source ?? session.trackSource
  const trackSource = useMemo(() => injected ?? createTrackSource(), [injected])
  const [progress, setProgress] = useState<UrlImportProgress | undefined>(
    undefined
  )
  const [error, setError] = useState<ImportUrlErrorCode | undefined>(undefined)
  const [running, setRunning] = useState(false)
  const runIdRef = useRef(0)
  const controllerRef = useRef<AbortController | undefined>(undefined)
  const online = useOnline()

  function submit(url: string): void {
    if (running) {
      return
    }
    const runId = ++runIdRef.current
    const controller = new AbortController()
    controllerRef.current = controller
    setRunning(true)
    setError(undefined)
    // Phase known, fraction not: the bar stays indeterminate until a real tick.
    setProgress({ phase: 'downloading', fraction: undefined })
    void importFromUrl(
      { url },
      {
        source: trackSource,
        signal: controller.signal,
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
        // The translated copy speaks for the code; the raw detail is for the
        // console (the AV.1 standard, same as the separation).
        console.error('url import failed:', result.code, result.detail)
        setError(result.code)
      }
    })
  }

  function cancel(): void {
    if (!running) {
      return
    }
    // Abort the transfer and supersede the run: its rejection resolves as a
    // stale result (the bumped run-id) and never surfaces as an error.
    controllerRef.current?.abort()
    runIdRef.current++
    setRunning(false)
    setProgress(undefined)
  }

  return {
    progress,
    error,
    running,
    offline: !online,
    submit,
    cancel,
    dismissError: () => setError(undefined)
  }
}
