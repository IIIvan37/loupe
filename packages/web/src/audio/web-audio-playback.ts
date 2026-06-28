import type { DecodedAudio, PlaybackEngine } from '@app/core'

type PositionListener = (seconds: number) => void

/**
 * Driven adapter for the `PlaybackEngine` port: plays decoded audio through an
 * `AudioBufferSourceNode` and streams the elapsed position back on every frame.
 * Position is derived from `AudioContext.currentTime` (sample-accurate); the
 * source node is one-shot, so play/seek recreate it. The only place that touches
 * Web Audio playback — the core stays timer-free.
 */
export function createWebAudioPlayback(): PlaybackEngine {
  const listeners = new Set<PositionListener>()
  let context: AudioContext | undefined
  let buffer: AudioBuffer | undefined
  let source: AudioBufferSourceNode | undefined
  let frame: number | undefined
  let isPlaying = false
  // Position bookkeeping: where the current run started, and the context clock
  // reading at that moment. Live position = startOffset + (now - startedAt).
  let startOffset = 0
  let startedAt = 0

  function audioContext(): AudioContext {
    context ??= new AudioContext()
    return context
  }

  function positionOf(buf: AudioBuffer): number {
    const raw = isPlaying
      ? startOffset + (audioContext().currentTime - startedAt)
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
    const context = audioContext()
    const node = context.createBufferSource()
    node.buffer = buf
    node.connect(context.destination)
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
    startedAt = context.currentTime
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

    onPositionChange(listener: PositionListener): () => void {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    }
  }
}
