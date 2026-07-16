import type { DecodedAudio } from '@app/core'

/**
 * The decode `AudioBuffer` behind a `DecodedAudio`, keyed by identity (V.5).
 *
 * The decoder's channels ARE zero-copy views into that buffer's storage, so
 * playing the buffer and reading the channels share one PCM allocation
 * (~88 MB for a 4-min stereo track) instead of `audioBufferFrom` copying it
 * again per engine — the single-track engine at load, and the « Piste » stem
 * at the metronome seat (`buildTrackStem` passes `loadedAudio` verbatim).
 *
 * Contract: shared storage is READ-ONLY (the same convention as `stemAudio`
 * views — a write would be audible and corrupt every analysis). Playing an
 * AudioBuffer keeps `getChannelData` views valid (verified on Chrome 150;
 * the spec's copy-on-write « acquire the contents » never detaches them).
 * Keyed weakly so the buffer is released with the audio it backs.
 */
const memo = new WeakMap<DecodedAudio, AudioBuffer>()

/** Register the buffer whose storage `audio`'s channels are views into. */
export function rememberAudioBuffer(
  audio: DecodedAudio,
  buffer: AudioBuffer
): void {
  memo.set(audio, buffer)
}

/** The registered decode buffer for `audio`, or undefined (→ copy). */
export function recallAudioBuffer(
  audio: DecodedAudio
): AudioBuffer | undefined {
  return memo.get(audio)
}
