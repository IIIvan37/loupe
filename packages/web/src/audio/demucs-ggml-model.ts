import type { SeparationPhase } from '@app/core'
import type { StereoChannels } from './audio-format.ts'

/**
 * Contract for the demucs.cpp (GGML) engine — htdemucs compiled to WebAssembly,
 * the freemusicdemixer lineage. Unlike the ONNX path it runs as a single-threaded
 * SIMD wasm with no fp32 upcast or weight pre-packing, so it fits in memory and
 * needs no COOP/COEP. The engine (public/demucs/demucs.{js,wasm}) is built by
 * scripts/build-demucs.sh; this model is its fp16 weights file.
 *
 * Weights licence: htdemucs is trained on the non-commercial MUSDB18 dataset and
 * is "provided only for scientific purposes" (facebookresearch/demucs#327) — fine
 * for loupe's non-commercial use, not for a commercial product. Same posture as
 * the ONNX adapter.
 */
export const GGML_MODEL_URL =
  'https://huggingface.co/datasets/Retrobear/demucs.cpp/resolve/main/ggml-model-htdemucs-4s-f16.bin'

/** htdemucs 4-stem: the engine writes targets [drums, bass, other, vocals]. */
export const GGML_STEM_COUNT = 4

/**
 * Messages the GGML worker emits. The structured `type` ones are ours; the `msg`
 * ones are posted straight from the C++ (`EM_JS` `postMessage`): `PROGRESS_UPDATE`
 * (inference fraction, the one we forward) and `WASM_LOG` (cout/cerr, ignored).
 */
export type GgmlWorkerMessage =
  | {
      readonly type: 'progress'
      readonly phase: SeparationPhase
      readonly fraction: number
    }
  | { readonly type: 'done'; readonly stems: ReadonlyArray<StereoChannels> }
  | { readonly type: 'error'; readonly message: string }
  | { readonly msg: 'PROGRESS_UPDATE'; readonly data: number }
  | { readonly msg: 'WASM_LOG'; readonly data: string }
