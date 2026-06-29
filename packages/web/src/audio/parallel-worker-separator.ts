import {
  overlapAdd,
  planChunks,
  type Segment,
  type SeparationPhase,
  type StemSeparator,
  transitionWindow,
  type WindowedPiece
} from '@app/core'
import type { StereoChannels } from './audio-format.ts'
import { toStereo44100 } from './resample.ts'
import { toSeparatedStems } from './stem-layout.ts'
import type { WorkerDispatch } from './worker-separator.ts'

/** htdemucs returns four stereo stems, in model order. */
const MODEL_STEM_COUNT = 4

export interface ParallelOptions {
  /** How many workers to fan out to — evaluated per run (e.g. from CPU count). */
  readonly workerCount: () => number
  /** Overlap context (samples) shared between neighbouring chunks for blending. */
  readonly context: number
}

/** Weighted overlap-add of the per-chunk stems back into full-length stems. */
function combineStems(
  totalSamples: number,
  plan: readonly Segment[],
  window: Float32Array,
  perChunk: ReadonlyArray<ReadonlyArray<StereoChannels>>
): StereoChannels[] {
  const stems: StereoChannels[] = []
  for (let stem = 0; stem < MODEL_STEM_COUNT; stem++) {
    const left: WindowedPiece[] = []
    const right: WindowedPiece[] = []
    plan.forEach((chunk, index) => {
      const source = perChunk[index]?.[stem]
      if (source) {
        const win = window.subarray(0, chunk.length)
        left.push({ start: chunk.start, samples: source.left, window: win })
        right.push({ start: chunk.start, samples: source.right, window: win })
      }
    })
    stems.push({
      left: overlapAdd(totalSamples, left),
      right: overlapAdd(totalSamples, right)
    })
  }
  return stems
}

/**
 * Data-parallel `StemSeparator`: split the track into overlapping chunks, run each
 * through its own worker concurrently, then blend the results with a windowed
 * overlap-add (the pure core DSP). ~N× faster on a multi-core machine, at N× the
 * model memory, with no COOP/COEP (separate workers, not threads). One chunk (a
 * short track, or `workerCount() === 1`) reduces to the single-worker behaviour
 * with no seam. The per-engine `dispatch` maps each worker's messages to its stems.
 */
export function createParallelWorkerSeparator(
  spawn: () => Worker,
  dispatch: WorkerDispatch,
  options: ParallelOptions
): StemSeparator {
  let active: Worker[] = []
  let rejectActive: ((error: Error) => void) | undefined

  function terminateActive(): void {
    for (const worker of active) {
      worker.terminate()
    }
    active = []
  }

  return {
    async separate(audio, onProgress) {
      const { left, right } = await toStereo44100(audio)
      const total = left.length

      // Supersede any in-flight run: kill its workers and reject its promise.
      terminateActive()
      rejectActive?.(new Error('superseded by a newer separation'))
      rejectActive = undefined
      if (total === 0) {
        return []
      }

      const count = Math.max(1, options.workerCount())
      const chunkCount = total <= 2 * options.context ? 1 : count
      const stride = Math.max(1, Math.ceil(total / chunkCount))
      const plan = planChunks(total, chunkCount, options.context)
      const window = transitionWindow(stride + options.context, options.context)

      const fractions = new Array<number>(plan.length).fill(0)
      let phase: SeparationPhase = 'analysing'
      const workers: Worker[] = []
      active = workers

      // A run is settled by its chunks completing OR by being superseded.
      const superseded = new Promise<never>((_, reject) => {
        rejectActive = reject
      })
      const chunkRuns = plan.map(
        (chunk, index) =>
          new Promise<ReadonlyArray<StereoChannels>>((resolve, reject) => {
            const worker = spawn()
            workers.push(worker)
            worker.onmessage = (event: MessageEvent) =>
              dispatch(event.data, resolve, reject, (progress) => {
                fractions[index] = progress.fraction
                phase = progress.phase
                const done = fractions.reduce((sum, f) => sum + f, 0)
                onProgress({ phase, fraction: done / fractions.length })
              })
            worker.onerror = (event) =>
              reject(new Error(event.message || 'separation worker crashed'))
            const l = left.slice(chunk.start, chunk.start + chunk.length)
            const r = right.slice(chunk.start, chunk.start + chunk.length)
            worker.postMessage({ left: l, right: r }, [l.buffer, r.buffer])
          })
      )

      try {
        const perChunk = await Promise.race([
          Promise.all(chunkRuns),
          superseded
        ])
        return toSeparatedStems(combineStems(total, plan, window, perChunk))
      } finally {
        for (const worker of workers) {
          worker.terminate()
        }
        if (active === workers) {
          active = []
          rejectActive = undefined
        }
      }
    }
  }
}
