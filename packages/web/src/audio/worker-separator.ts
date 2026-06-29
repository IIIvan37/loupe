import type {
  SeparationPhase,
  SeparationProgress,
  StemSeparator
} from '@app/core'
import type { StereoChannels } from './audio-format.ts'
import { toStereo44100 } from './resample.ts'
import { toSeparatedStems } from './stem-layout.ts'

/** The progress / done / error messages every separator worker posts. */
export type StandardSeparatorMessage =
  | {
      readonly type: 'progress'
      readonly phase: SeparationPhase
      readonly fraction: number
    }
  | { readonly type: 'done'; readonly stems: ReadonlyArray<StereoChannels> }
  | { readonly type: 'error'; readonly message: string }

/**
 * Translate one raw worker message into the run's outcome: drive `onProgress`,
 * `resolve` with the model-ordered stems, or `reject`. Each engine plugs in its
 * own message shape here; everything else (lifecycle, transfer, cleanup) is shared.
 */
export type WorkerDispatch = (
  data: unknown,
  resolve: (stems: ReadonlyArray<StereoChannels>) => void,
  reject: (error: Error) => void,
  onProgress: (progress: SeparationProgress) => void
) => void

/** Map a standard message to resolve / reject / onProgress (shared by all engines). */
export function dispatchStandard(
  message: StandardSeparatorMessage,
  resolve: (stems: ReadonlyArray<StereoChannels>) => void,
  reject: (error: Error) => void,
  onProgress: (progress: SeparationProgress) => void
): void {
  if (message.type === 'progress') {
    onProgress({ phase: message.phase, fraction: message.fraction })
  } else if (message.type === 'done') {
    resolve(message.stems)
  } else {
    reject(new Error(message.message))
  }
}

/**
 * Build a `StemSeparator` around an off-main-thread worker: resample to stereo
 * 44.1 kHz, hand the PCM to a freshly spawned worker, and map its messages via
 * `dispatch`. One run at a time — a new separation terminates the in-flight worker
 * AND settles its (now-abandoned) promise so it can't dangle, then the worker is
 * always terminated on completion. Lazy: nothing spawns until `separate` runs.
 */
export function createWorkerSeparator(
  spawn: () => Worker,
  dispatch: WorkerDispatch
): StemSeparator {
  let active: Worker | undefined
  let rejectActive: ((error: Error) => void) | undefined

  return {
    async separate(audio, onProgress) {
      const { left, right } = await toStereo44100(audio)

      // Supersede any in-flight run: kill its worker and reject its dangling
      // promise (a terminated worker fires no more messages, so it never settles).
      active?.terminate()
      rejectActive?.(new Error('superseded by a newer separation'))

      const worker = spawn()
      active = worker
      try {
        const stems = await new Promise<ReadonlyArray<StereoChannels>>(
          (resolve, reject) => {
            rejectActive = reject
            worker.onmessage = (event: MessageEvent) =>
              dispatch(event.data, resolve, reject, onProgress)
            worker.onerror = (event) =>
              reject(new Error(event.message || 'separation worker crashed'))
            worker.postMessage({ left, right }, [left.buffer, right.buffer])
          }
        )
        return toSeparatedStems(stems)
      } finally {
        worker.terminate()
        if (active === worker) {
          active = undefined
          rejectActive = undefined
        }
      }
    }
  }
}
