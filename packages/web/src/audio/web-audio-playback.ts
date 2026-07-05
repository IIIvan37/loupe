import type { DecodedAudio, PlaybackEngine } from '@app/core'
import type { SoundTouchNode } from '@soundtouchjs/audio-worklet'
import { audioBufferFrom, loadSoundTouchNode } from './web-audio-shared.ts'

type PositionListener = (seconds: number) => void

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
 * Position is derived from `AudioContext.currentTime` scaled by the tempo ratio.
 * Untested (jsdom has no Web Audio / AudioWorklet) — a humble object verified in
 * a real browser.
 */
export function createWebAudioPlayback(): PlaybackEngine {
  const listeners = new Set<PositionListener>()
  let context: AudioContext | undefined
  let stretch: SoundTouchNode | undefined
  let buffer: AudioBuffer | undefined
  let source: AudioBufferSourceNode | undefined
  let frame: number | undefined
  let isPlaying = false
  // Position bookkeeping: where the current run started, and the context clock at
  // that moment. Live position = startOffset + ratio * (now - startedAt).
  let startOffset = 0
  let startedAt = 0
  let timeRatio = 1
  let pitchSemitones = 0

  function audioContext(): AudioContext {
    context ??= new AudioContext()
    return context
  }

  /** Lazily create the SoundTouch node; on failure, fall back to plain output. */
  async function ensureStretch(): Promise<void> {
    if (stretch) {
      return
    }
    // No worklet → basic playback still works (source → destination), only the
    // tempo/pitch controls go inert. Verified/fixed in the browser.
    stretch = await loadSoundTouchNode(audioContext(), {
      timeRatio,
      pitchSemitones
    })
  }

  function outputNode(): AudioNode {
    return stretch ?? audioContext().destination
  }

  function positionOf(buf: AudioBuffer): number {
    const raw = isPlaying
      ? startOffset + timeRatio * (audioContext().currentTime - startedAt)
      : startOffset
    return Math.min(Math.max(raw, 0), buf.duration)
  }

  function emit(): void {
    if (!buffer) {
      return
    }
    const seconds = positionOf(buffer)
    for (const listener of listeners) {
      listener(seconds)
    }
  }

  function loop(): void {
    emit()
    if (isPlaying) {
      frame = requestAnimationFrame(loop)
    }
  }

  function stopSource(): void {
    if (source) {
      source.onended = null
      source.stop()
      source.disconnect()
      source = undefined
    }
    if (frame !== undefined) {
      cancelAnimationFrame(frame)
      frame = undefined
    }
  }

  function startSource(buf: AudioBuffer, offset: number): void {
    const ctx = audioContext()
    const node = ctx.createBufferSource()
    node.buffer = buf
    node.playbackRate.value = timeRatio
    node.connect(outputNode())
    node.onended = () => {
      // Fire only for a natural end, not a stop()/seek that replaced the node.
      if (source === node) {
        stopSource()
        isPlaying = false
        startOffset = buf.duration
        emit()
      }
    }
    startOffset = offset
    startedAt = ctx.currentTime
    isPlaying = true
    node.start(0, offset)
    source = node
    frame = requestAnimationFrame(loop)
  }

  return {
    async load(audio: DecodedAudio): Promise<void> {
      stopSource()
      isPlaying = false
      startOffset = 0
      await ensureStretch()
      buffer = audioBufferFrom(audioContext(), audio)
      emit()
    },

    play(): void {
      if (!buffer || isPlaying) {
        return
      }
      void audioContext().resume()
      // Replaying from the very end restarts from the top.
      const offset = startOffset >= buffer.duration ? 0 : startOffset
      startSource(buffer, offset)
    },

    pause(): void {
      if (!buffer || !isPlaying) {
        return
      }
      const position = positionOf(buffer)
      stopSource()
      isPlaying = false
      startOffset = position
      emit()
    },

    seekTo(seconds: number): void {
      if (!buffer) {
        return
      }
      const target = Math.min(Math.max(seconds, 0), buffer.duration)
      if (isPlaying) {
        stopSource()
        startSource(buffer, target)
      } else {
        startOffset = target
        emit()
      }
    },

    setTimeRatio(ratio: number): void {
      // Re-baseline the position before changing the scale, so the elapsed-time
      // maths stays continuous across the ratio change.
      if (buffer && isPlaying) {
        startOffset = positionOf(buffer)
        startedAt = audioContext().currentTime
      }
      timeRatio = ratio
      if (source) {
        source.playbackRate.value = ratio
      }
      if (stretch) {
        stretch.playbackRate.value = ratio
      }
    },

    setPitchSemitones(semitones: number): void {
      pitchSemitones = semitones
      if (stretch) {
        stretch.pitchSemitones.value = semitones
      }
    },

    onPositionChange(listener: PositionListener): () => void {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    }
  }
}
