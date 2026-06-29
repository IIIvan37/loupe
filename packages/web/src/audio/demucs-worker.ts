/// <reference lib="webworker" />
import { planSegments, type Segment, transitionWindow } from '@app/core'
import * as ort from 'onnxruntime-web/wasm'
import type { StereoChannels } from './audio-format.ts'
import {
  loadModel,
  OVERLAP_SAMPLES,
  SEGMENT_SAMPLES,
  type SeparateRequest,
  type WorkerMessage
} from './demucs-model.ts'

// Single-threaded SIMD CPU wasm: no SharedArrayBuffer, so no COOP/COEP headers
// (Netlify-friendly). WebGPU was tried for speed but ORT-web 1.27 can't run this
// model's embedded iSTFT on the GPU (ConstantOfShape unsupported), and the GPU
// bundle's asyncify wasm drops the CPU kernel for it — so we stay on the plain
// wasm build, whose CPU kernels run the whole graph. Override only the .wasm URL
// (vendored under /ort/): with no prefix/.mjs override ORT uses its bundled JS
// glue rather than importing it from /public, which Vite forbids.
ort.env.wasm.wasmPaths = { wasm: '/ort/ort-wasm-simd-threaded.wasm' }
ort.env.wasm.numThreads = 1

const worker = globalThis as unknown as DedicatedWorkerGlobalScope
const N = SEGMENT_SAMPLES

function post(message: WorkerMessage, transfer: Transferable[] = []): void {
  worker.postMessage(message, transfer)
}

async function createSession(
  model: ArrayBuffer
): Promise<ort.InferenceSession> {
  // 'disabled' skips the optimiser's weight pre-packing: that second weight copy
  // would OOM the wasm32 heap (std::bad_alloc) on top of htdemucs's fp16→fp32
  // upcast at session creation.
  return ort.InferenceSession.create(model, {
    executionProviders: ['wasm'],
    graphOptimizationLevel: 'disabled',
    enableCpuMemArena: false,
    enableMemPattern: false
  })
}

/** Fixed-length [1, 2, N] input for one window, zero-padded past the real samples. */
function buildInput(
  left: Float32Array,
  right: Float32Array,
  { start, length }: Segment
): Float32Array {
  const input = new Float32Array(2 * N)
  input.set(left.subarray(start, start + length), 0)
  input.set(right.subarray(start, start + length), N)
  return input
}

/** Weighted overlap-add of one window's four stems into the running buffers. */
function accumulate(
  stems: readonly StereoChannels[],
  weight: Float32Array,
  window: Float32Array,
  output: Float32Array,
  { start, length }: Segment
): void {
  stems.forEach((stem, st) => {
    const leftBase = st * 2 * N
    const rightBase = (st * 2 + 1) * N
    for (let i = 0; i < length; i++) {
      const w = window[i] ?? 0
      const at = start + i
      stem.left[at] = (stem.left[at] ?? 0) + (output[leftBase + i] ?? 0) * w
      stem.right[at] = (stem.right[at] ?? 0) + (output[rightBase + i] ?? 0) * w
    }
  })
  for (let i = 0; i < length; i++) {
    const at = start + i
    weight[at] = (weight[at] ?? 0) + (window[i] ?? 0)
  }
}

/** Turn the weighted sums into a true weighted average. */
function normalize(
  stems: readonly StereoChannels[],
  weight: Float32Array
): void {
  for (const stem of stems) {
    for (let i = 0; i < weight.length; i++) {
      const w = weight[i] ?? 0
      const gain = w > 0 ? 1 / w : 0
      stem.left[i] = (stem.left[i] ?? 0) * gain
      stem.right[i] = (stem.right[i] ?? 0) * gain
    }
  }
}

/** Run the whole separation: load + session create (analysing), then inference. */
async function separate({ left, right }: SeparateRequest): Promise<void> {
  const model = await loadModel((fraction) =>
    post({ type: 'progress', phase: 'analysing', fraction })
  )
  const session = await createSession(model)
  const inputName = session.inputNames[0] ?? 'mix'
  const outputName = session.outputNames[0] ?? 'stems'

  const total = left.length
  const segments = planSegments(total, N, OVERLAP_SAMPLES)
  const window = transitionWindow(N, OVERLAP_SAMPLES)
  // Four stems in model order: drums, bass, other, vocals.
  const stems: StereoChannels[] = Array.from({ length: 4 }, () => ({
    left: new Float32Array(total),
    right: new Float32Array(total)
  }))
  const weight = new Float32Array(total)

  for (let s = 0; s < segments.length; s++) {
    const segment = segments[s]
    if (!segment) {
      continue
    }
    // One session, one inference at a time: parallel runs would multiply memory
    // (the model already OOMs near the wasm32 ceiling) and ORT serialises them.
    // react-doctor-disable-next-line react-doctor/async-await-in-loop
    const results = await session.run({
      [inputName]: new ort.Tensor('float32', buildInput(left, right, segment), [
        1,
        2,
        N
      ])
    })
    const output = results[outputName]?.data
    if (!(output instanceof Float32Array)) {
      throw new TypeError('separator returned no stems')
    }
    accumulate(stems, weight, window, output, segment)
    post({
      type: 'progress',
      phase: 'separating',
      fraction: (s + 1) / segments.length
    })
  }

  normalize(stems, weight)
  const transfer = stems.flatMap((stem) => [
    stem.left.buffer,
    stem.right.buffer
  ])
  post({ type: 'done', stems }, transfer)
}

worker.onmessage = (event: MessageEvent<SeparateRequest>) => {
  separate(event.data).catch((error: unknown) => {
    post({
      type: 'error',
      message: error instanceof Error ? error.message : String(error)
    })
  })
}
