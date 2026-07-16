import type { DecodedAudio, PlaybackEngine } from '@app/core'
import { audioBufferFrom, createStretchTransport } from './web-audio-shared.ts'

/**
 * Driven adapter for the `PlaybackEngine` port. Plays decoded audio through an
 * `AudioBufferSourceNode`, routed via a SoundTouch worklet so tempo and pitch
 * move independently:
 *
 *  - tempo is the source node's `playbackRate` (keeps the stream real-time, so
 *    the worklet never under-runs) — but `playbackRate` also transposes;
 *  - the SoundTouch node mirrors that rate (`node.playbackRate`) and divides the
 *    pitch by it automatically, so `node.pitchSemitones` is the net shift.
 *
 * The context, stretch bus and position clock live in the shared
 * `StretchTransport`; this engine only manages its single source node.
 * Untested (jsdom has no Web Audio / AudioWorklet) — a humble object verified
 * in a real browser.
 */
export function createWebAudioPlayback(): PlaybackEngine {
  let buffer: AudioBuffer | undefined
  let source: AudioBufferSourceNode | undefined
  // Last load wins: a lazy hand-back reload racing a fresh import must never
  // let the slower (stale) load land its buffer on top of the newer one.
  let loadId = 0
  const transport = createStretchTransport(() => buffer?.duration)

  function stopSource(): void {
    if (source) {
      source.onended = null
      source.stop()
      source.disconnect()
      source = undefined
    }
    transport.cancelFrame()
  }

  function startSource(buf: AudioBuffer, offset: number): void {
    const node = transport.audioContext().createBufferSource()
    node.buffer = buf
    node.playbackRate.value = transport.timeRatio()
    node.connect(transport.outputNode())
    node.onended = () => {
      // Fire only for a natural end, not a stop()/seek that replaced the node.
      if (source === node) {
        stopSource()
        transport.stopAt(buf.duration)
        transport.emit()
      }
    }
    node.start(0, offset)
    source = node
    transport.beginRun(offset)
  }

  return {
    async load(audio: DecodedAudio): Promise<void> {
      loadId += 1
      const id = loadId
      stopSource()
      transport.stopAt(0)
      await transport.ensureStretch()
      if (id !== loadId) {
        return
      }
      buffer = audioBufferFrom(transport.audioContext(), audio)
      transport.emit()
    },

    play(): void {
      if (!buffer || transport.isPlaying()) {
        return
      }
      void transport.audioContext().resume()
      // Replaying from the very end restarts from the top.
      const resting = transport.position()
      startSource(buffer, resting >= buffer.duration ? 0 : resting)
    },

    pause(): void {
      if (!buffer || !transport.isPlaying()) {
        return
      }
      const position = transport.position()
      stopSource()
      transport.stopAt(position)
      transport.emit()
    },

    seekTo(seconds: number): void {
      if (!buffer) {
        return
      }
      const target = Math.min(Math.max(seconds, 0), buffer.duration)
      if (transport.isPlaying()) {
        stopSource()
        startSource(buffer, target)
      } else {
        transport.stopAt(target)
        transport.emit()
      }
    },

    setTimeRatio(ratio: number): void {
      transport.setTimeRatio(ratio, (value) => {
        if (source) {
          source.playbackRate.value = value
        }
      })
    },

    setPitchSemitones(semitones: number): void {
      transport.setPitchSemitones(semitones)
    },

    unload(): void {
      // Drop the decoded buffer (the point: ~85 MB float32 for a 4-min track)
      // without emitting — the caller owns where the shared playhead sits.
      stopSource()
      buffer = undefined
    },

    onPositionChange: transport.onPositionChange
  }
}
