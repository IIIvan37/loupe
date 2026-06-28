import type { DecodedAudio, PlaybackEngine } from '@app/core'
import type { RubberBandNode } from 'rubberband-web'

type PositionListener = (seconds: number) => void

/** Self-contained Rubber Band worklet (wasm embedded), copied to `public/`. */
const RUBBERBAND_PROCESSOR_URL = '/rubberband-processor.js'

/**
 * Driven adapter for the `PlaybackEngine` port. Plays decoded audio through an
 * `AudioBufferSourceNode`, routed via a Rubber Band worklet so tempo and pitch
 * move independently:
 *
 *  - tempo is the source node's `playbackRate` (keeps the stream real-time, so
 *    the worklet never under-runs) — but `playbackRate` also transposes;
 *  - the Rubber Band node's `setPitch` cancels that transposition and applies the
 *    wanted shift: `pitch = 2^(semitones/12) / ratio`.
 *
 * Position is derived from `AudioContext.currentTime` scaled by the tempo ratio.
 * Untested (jsdom has no Web Audio / AudioWorklet) — a humble object verified in
 * a real browser.
 */
export function createWebAudioPlayback(): PlaybackEngine {
  const listeners = new Set<PositionListener>()
  let context: AudioContext | undefined
  let rubberBand: RubberBandNode | undefined
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

  /** Lazily create the Rubber Band node; on failure, fall back to plain output. */
  async function ensureRubberBand(): Promise<void> {
    if (rubberBand) {
      return
    }
    const ctx = audioContext()
    try {
      // Loaded lazily (browser only): it pulls a wasm/worklet bundle we never
      // want in the test/node path.
      const { createRubberBandNode } = await import('rubberband-web')
      const node = await createRubberBandNode(ctx, RUBBERBAND_PROCESSOR_URL)
      node.connect(ctx.destination)
      applyPitch(node)
      rubberBand = node
    } catch {
      // No worklet → basic playback still works (source → destination), only the
      // tempo/pitch controls go inert. Verified/fixed in the browser.
      rubberBand = undefined
    }
  }

  function outputNode(): AudioNode {
    return rubberBand ?? audioContext().destination
  }

  function applyPitch(node: RubberBandNode | undefined): void {
    node?.setTempo(1)
    node?.setPitch(2 ** (pitchSemitones / 12) / timeRatio)
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
      await ensureRubberBand()
      const channelCount = Math.max(audio.channels.length, 1)
      const frames = Math.max(audio.channels[0]?.length ?? 0, 1)
      const buf = audioContext().createBuffer(
        channelCount,
        frames,
        audio.sampleRate
      )
      audio.channels.forEach((channel, index) => {
        buf.copyToChannel(
          Float32Array.from(channel as ArrayLike<number>),
          index
        )
      })
      buffer = buf
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
      applyPitch(rubberBand)
    },

    setPitchSemitones(semitones: number): void {
      pitchSemitones = semitones
      applyPitch(rubberBand)
    },

    onPositionChange(listener: PositionListener): () => void {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    }
  }
}
