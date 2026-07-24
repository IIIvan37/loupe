/**
 * Raw decoded PCM: one array of samples (normalised to [-1, 1]) per channel,
 * every channel the same length. The shape the Web Audio `AudioBuffer` exposes.
 * Kernel type: the audio language every driven port speaks (decoder, players,
 * detectors, separator) — promoted to `shared/` when the rhythm module took
 * its ports out of the nursery `ports.ts`.
 */
export interface DecodedAudio {
  readonly sampleRate: number
  readonly channels: ReadonlyArray<ArrayLike<number>>
}
