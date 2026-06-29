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

export interface ParallelOptions {
  /** How many workers to fan out to — evaluated per run (e.g. from CPU count). */
  readonly workerCount: () => number
  /** Overlap context (samples) shared between neighbouring chunks for blending. */
  readonly context: number
}

/**
 * Weighted overlap-add of the per-chunk stems back into full-length stems. Each
 * chunk's window ramps over `context` at both ends so neighbours cross-fade; at the
 * track's own edges a single chunk covers the sample, so the overlap-add normalises
 * it back to identity regardless of the ramp. The stem count is taken from the
 * workers' output, not assumed.
 */
function combineStems(
  totalSamples: number,
  plan: readonly Segment[],
  context: number,
  perChunk: ReadonlyArray<ReadonlyArray<StereoChannels>>
): StereoChannels[] {
  const stemCount = perChunk[0]?.length ?? 0
  const windows = plan.map((chunk) =>
    transitionWindow(chunk.length, Math.min(context, chunk.length))
  )
  const stems: StereoChannels[] = []
  for (let stem = 0; stem < stemCount; stem++) {
    const left: WindowedPiece[] = []
    const right: WindowedPiece[] = []
    plan.forEach((chunk, index) => {
      const source = perChunk[index]?.[stem]
      const window = windows[index]
      if (source && window) {
        left.push({ start: chunk.start, samples: source.left, window })
        right.push({ start: chunk.start, samples: source.right, window })
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

      // Cap the fan-out so each chunk does unique work: a chunk spans
      // stride + context, so stride ≥ 2·context keeps neighbours adjacent (no
      // triple overlap) and the first chunk from covering the whole track.
      const chunkCount = Math.max(
        1,
        Math.min(
          options.workerCount(),
          Math.floor(total / (2 * options.context))
        )
      )
      const plan = planChunks(total, chunkCount, options.context)

      const fractions = new Array<number>(plan.length).fill(0)
      const phases = new Array<SeparationPhase>(plan.length).fill('analysing')
      const workers: Worker[] = []
      active = workers

      // Aggregate progress: average the chunks' fractions; stay 'analysing' until
      // every worker has moved on to separating.
      function reportChunkProgress(
        index: number,
        fraction: number,
        phase: SeparationPhase
      ): void {
        fractions[index] = fraction
        phases[index] = phase
        const done = fractions.reduce((sum, f) => sum + f, 0)
        onProgress({
          phase: phases.every((p) => p === 'separating')
            ? 'separating'
            : 'analysing',
          fraction: done / fractions.length
        })
      }

      function runChunk(
        chunk: Segment,
        index: number
      ): Promise<ReadonlyArray<StereoChannels>> {
        return new Promise((resolve, reject) => {
          const worker = spawn()
          workers.push(worker)
          worker.onmessage = (event: MessageEvent) =>
            dispatch(event.data, resolve, reject, (progress) =>
              reportChunkProgress(index, progress.fraction, progress.phase)
            )
          worker.onerror = (event) =>
            reject(new Error(event.message || 'separation worker crashed'))
          const l = left.slice(chunk.start, chunk.start + chunk.length)
          const r = right.slice(chunk.start, chunk.start + chunk.length)
          worker.postMessage({ left: l, right: r }, [l.buffer, r.buffer])
        })
      }

      // A run is settled by its chunks completing OR by being superseded.
      const superseded = new Promise<never>((_, reject) => {
        rejectActive = reject
      })
      const all = Promise.all(plan.map(runChunk))
      // If `superseded` wins the race, a straggler chunk that rejects afterwards
      // must not surface as an unhandled rejection.
      all.catch(() => {})
      try {
        const perChunk = await Promise.race([all, superseded])
        return toSeparatedStems(
          combineStems(total, plan, options.context, perChunk)
        )
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
