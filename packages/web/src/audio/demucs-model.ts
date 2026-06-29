import type { SeparationPhase } from '@app/core'
import { fetchCachedModel } from './model-cache.ts'

/**
 * The Demucs ONNX model contract + a cached, progress-reporting loader.
 *
 * Model: StemSplit's single-file htdemucs export (fp16 weights, ~166 MB). The
 * STFT/iSTFT are baked into the graph, so it is waveform-in / waveform-out — no
 * spectral code on our side. It takes one input `mix [1, 2, N]` (stereo, 44.1 kHz)
 * and returns `stems [1, 4, 2, N]` in the order [drums, bass, other, vocals].
 *
 * Weights licence — read before redistributing: the htdemucs weights are trained
 * on the non-commercial MUSDB18 dataset and the Demucs author states they are
 * "provided only for scientific purposes" (facebookresearch/demucs#327). loupe is
 * a non-commercial, public practice tool, so this scientific-purposes use is
 * acceptable; do NOT ship these weights in a commercial product.
 */
const MODEL_URL =
  'https://huggingface.co/StemSplitio/htdemucs-onnx/resolve/main/htdemucs_fp16weights.onnx'

/** Fixed inference window the graph expects: 7.8 s at 44.1 kHz. */
export const SEGMENT_SAMPLES = 343980
/** 25 % overlap between consecutive windows (Demucs default). */
export const OVERLAP_SAMPLES = 85995
/** The rate the model is trained at; we resample anything else to it. */
export const TARGET_SAMPLE_RATE = 44100

/** Worker → adapter messages. The stems come back in model order, transferred. */
export type WorkerMessage =
  | {
      readonly type: 'progress'
      readonly phase: SeparationPhase
      readonly fraction: number
    }
  | {
      readonly type: 'done'
      readonly stems: ReadonlyArray<{
        readonly left: Float32Array
        readonly right: Float32Array
      }>
    }
  | { readonly type: 'error'; readonly message: string }

/** Adapter → worker message: the already-resampled stereo mix to separate. */
export interface SeparateRequest {
  readonly left: Float32Array
  readonly right: Float32Array
}

/** Fetch the ONNX model bytes (~166 MB), cached so the download happens once. */
export async function loadModel(
  onProgress: (fraction: number) => void
): Promise<ArrayBuffer> {
  return fetchCachedModel(MODEL_URL, onProgress)
}
