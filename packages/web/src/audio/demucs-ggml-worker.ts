/// <reference lib="webworker" />

import type { StereoChannels } from './audio-format.ts'
import {
  GGML_MODEL_URL,
  GGML_STEM_COUNT,
  type GgmlWorkerMessage
} from './demucs-ggml-model.ts'
import { fetchCachedModel } from './model-cache.ts'

/** The emscripten module exported by the vendored demucs.cpp glue (`libdemucs`). */
interface DemucsModule {
  _malloc(size: number): number
  _free(ptr: number): void
  _modelInit(ptr: number, size: number): void
  // (L, R, length, L0,R0, … L6,R6, batch) — 7 stereo target slots + a batch flag.
  _modelDemixSegment: (...args: number[]) => void
  readonly HEAPU8: Uint8Array
  readonly HEAPF32: Float32Array
}
type DemucsFactory = (opts?: {
  locateFile?: (path: string) => string
}) => Promise<DemucsModule>

/**
 * Load the vendored emscripten ES module at runtime. It lives in /public (a plain
 * asset, not part of the bundle), and Vite forbids importing /public from source —
 * so we `fetch` the glue text and import it from a blob URL instead. A module
 * worker can't `importScripts`, hence the dynamic import; `locateFile` still points
 * the wasm at /demucs/.
 */
async function loadDemucs(): Promise<DemucsFactory> {
  const response = await fetch('/demucs/demucs.js')
  const source = await response.text()
  const blobUrl = URL.createObjectURL(
    new Blob([source], { type: 'text/javascript' })
  )
  try {
    // react-doctor-disable-next-line react-doctor/no-dynamic-import-path
    const module = (await import(/* @vite-ignore */ blobUrl)) as {
      default: DemucsFactory
    }
    return module.default
  } finally {
    URL.revokeObjectURL(blobUrl)
  }
}

/** ABI target slots; htdemucs fills the first 4, the rest are passed as null. */
const TARGET_SLOTS = 7
const FLOAT_BYTES = 4
/** A sane floor for the fp16 model (~84 MB) — guards truncated / error-page downloads. */
const MIN_MODEL_BYTES = 1_000_000

const worker = globalThis as unknown as DedicatedWorkerGlobalScope

function post(message: GgmlWorkerMessage, transfer: Transferable[] = []): void {
  worker.postMessage(message, transfer)
}

/**
 * `_malloc` returns 0 on out-of-memory (it never throws under
 * ALLOW_MEMORY_GROWTH). Writing to / passing pointer 0 would silently corrupt the
 * wasm heap, so fail loudly instead.
 */
function alloc(module: DemucsModule, bytes: number): number {
  const ptr = module._malloc(bytes)
  if (ptr === 0) {
    throw new Error('out of memory allocating separation buffers')
  }
  return ptr
}

function freeAll(module: DemucsModule, ptrs: readonly number[]): void {
  for (const ptr of ptrs) {
    if (ptr !== 0) {
      module._free(ptr)
    }
  }
}

/** Copy each filled stem out of the heap (slicing detaches it from wasm memory). */
function readStems(
  module: DemucsModule,
  targets: readonly number[],
  length: number
): StereoChannels[] {
  const stems: StereoChannels[] = []
  for (let stem = 0; stem < GGML_STEM_COUNT; stem++) {
    const leftPtr = targets[stem * 2] ?? 0
    const rightPtr = targets[stem * 2 + 1] ?? 0
    stems.push({
      left: new Float32Array(module.HEAPF32.buffer, leftPtr, length).slice(),
      right: new Float32Array(module.HEAPF32.buffer, rightPtr, length).slice()
    })
  }
  return stems
}

/**
 * Spot-check the output is finite. demucs.cpp signals a bad model with `exit(1)`,
 * which this `noExitRuntime` build swallows (so `_modelInit` returns as if it
 * succeeded and inference runs on an uninitialised model). A corrupt/truncated
 * model then yields NaN/garbage rather than a clean failure — catch that here.
 */
function assertStemsFinite(stems: readonly StereoChannels[]): void {
  for (const stem of stems) {
    const step = Math.max(1, Math.floor(stem.left.length / 64))
    for (let i = 0; i < stem.left.length; i += step) {
      if (!Number.isFinite(stem.left[i])) {
        throw new Error(
          'separation produced invalid output (model may be corrupt)'
        )
      }
    }
  }
}

async function separate({ left, right }: StereoChannels): Promise<void> {
  const libdemucs = await loadDemucs()
  const modelBytes = new Uint8Array(
    await fetchCachedModel(GGML_MODEL_URL, (fraction) =>
      post({ type: 'progress', phase: 'analysing', fraction })
    )
  )
  if (modelBytes.byteLength < MIN_MODEL_BYTES) {
    throw new Error(
      `model download looks corrupt (${modelBytes.byteLength} bytes)`
    )
  }
  // The glue fetches its .wasm sibling, also vendored under /demucs/.
  const module = await libdemucs({ locateFile: (path) => `/demucs/${path}` })

  // Model init owns its own buffer: free it right after init (demucs.cpp copies
  // the weights into its own struct) to reclaim ~84 MB before inference.
  const modelPtr = alloc(module, modelBytes.byteLength)
  try {
    module.HEAPU8.set(modelBytes, modelPtr)
    module._modelInit(modelPtr, modelBytes.byteLength)
  } finally {
    module._free(modelPtr)
  }

  // Track every demix allocation so a mid-allocation OOM, a demix trap, or the
  // finiteness check all free the buffers — like a single C cleanup label.
  const length = left.length
  const pointers: number[] = []
  const allocTracked = (bytes: number): number => {
    const ptr = alloc(module, bytes)
    pointers.push(ptr)
    return ptr
  }
  try {
    const leftPtr = allocTracked(length * FLOAT_BYTES)
    module.HEAPF32.set(left, leftPtr / FLOAT_BYTES)
    const rightPtr = allocTracked(length * FLOAT_BYTES)
    module.HEAPF32.set(right, rightPtr / FLOAT_BYTES)

    // 7 stereo target slots; real buffers for the model's stems, 0 for the rest.
    const targets: number[] = []
    for (let slot = 0; slot < TARGET_SLOTS; slot++) {
      if (slot < GGML_STEM_COUNT) {
        targets.push(
          allocTracked(length * FLOAT_BYTES),
          allocTracked(length * FLOAT_BYTES)
        )
      } else {
        targets.push(0, 0)
      }
    }

    // The C++ runs htdemucs (its own internal segmentation + overlap-add) over the
    // whole track and streams progress via `postMessage({msg:'PROGRESS_UPDATE'})`.
    module._modelDemixSegment(leftPtr, rightPtr, length, ...targets, 0)

    const stems = readStems(module, targets, length)
    assertStemsFinite(stems)
    const transfer = stems.flatMap((stem) => [
      stem.left.buffer,
      stem.right.buffer
    ])
    post({ type: 'done', stems }, transfer)
  } finally {
    freeAll(module, pointers)
  }
}

worker.onmessage = (event: MessageEvent<StereoChannels>) => {
  separate(event.data).catch((error: unknown) => {
    post({
      type: 'error',
      message: error instanceof Error ? error.message : String(error)
    })
  })
}
