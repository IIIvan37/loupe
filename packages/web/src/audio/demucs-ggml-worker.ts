/// <reference lib="webworker" />

import {
  GGML_MODEL_URL,
  GGML_STEM_COUNT,
  type GgmlWorkerMessage,
  type StereoStem
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

const worker = globalThis as unknown as DedicatedWorkerGlobalScope

function post(message: GgmlWorkerMessage, transfer: Transferable[] = []): void {
  worker.postMessage(message, transfer)
}

/** Copy a channel into the wasm heap, returning its pointer. */
function writeChannel(module: DemucsModule, data: Float32Array): number {
  const ptr = module._malloc(data.length * FLOAT_BYTES)
  module.HEAPF32.set(data, ptr / FLOAT_BYTES)
  return ptr
}

/** Allocate the 7 stereo output slots; real buffers for the model's stems, 0 else. */
function allocTargets(module: DemucsModule, length: number): number[] {
  const ptrs: number[] = []
  for (let slot = 0; slot < TARGET_SLOTS; slot++) {
    if (slot < GGML_STEM_COUNT) {
      ptrs.push(
        module._malloc(length * FLOAT_BYTES),
        module._malloc(length * FLOAT_BYTES)
      )
    } else {
      ptrs.push(0, 0)
    }
  }
  return ptrs
}

/** Copy each filled stem out of the heap (slicing detaches it from wasm memory). */
function readStems(
  module: DemucsModule,
  targets: readonly number[],
  length: number
): StereoStem[] {
  const stems: StereoStem[] = []
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

async function separate({ left, right }: StereoStem): Promise<void> {
  const libdemucs = await loadDemucs()
  const modelBytes = new Uint8Array(
    await fetchCachedModel(GGML_MODEL_URL, (fraction) =>
      post({ type: 'progress', phase: 'analysing', fraction })
    )
  )
  // The glue fetches its .wasm sibling, also vendored under /demucs/.
  const module = await libdemucs({ locateFile: (path) => `/demucs/${path}` })

  const modelPtr = module._malloc(modelBytes.byteLength)
  module.HEAPU8.set(modelBytes, modelPtr)
  module._modelInit(modelPtr, modelBytes.byteLength)
  module._free(modelPtr)

  const length = left.length
  const leftPtr = writeChannel(module, left)
  const rightPtr = writeChannel(module, right)
  const targets = allocTargets(module, length)

  // The C++ runs htdemucs (its own internal segmentation + overlap-add) over the
  // whole track and streams progress via its own `postMessage({msg:'PROGRESS_UPDATE'})`.
  module._modelDemixSegment(leftPtr, rightPtr, length, ...targets, 0)

  const stems = readStems(module, targets, length)
  for (const ptr of [leftPtr, rightPtr, ...targets]) {
    if (ptr !== 0) {
      module._free(ptr)
    }
  }

  const transfer = stems.flatMap((stem) => [
    stem.left.buffer,
    stem.right.buffer
  ])
  post({ type: 'done', stems }, transfer)
}

worker.onmessage = (event: MessageEvent<StereoStem>) => {
  separate(event.data).catch((error: unknown) => {
    post({
      type: 'error',
      message: error instanceof Error ? error.message : String(error)
    })
  })
}
