/** The sample rate htdemucs is trained at; every separator resamples to it. */
export const TARGET_SAMPLE_RATE = 44100

/**
 * A stereo pair of PCM channels — the shape that flows in (the resampled mix) and
 * out (each isolated stem) of every separator engine. Engine-agnostic, so it lives
 * here rather than in any one model module.
 */
export interface StereoChannels {
  readonly left: Float32Array
  readonly right: Float32Array
}
