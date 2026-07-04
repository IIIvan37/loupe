import type { StemPlaybackEngine, StemSource } from '@app/core'
import type { SoundTouchNode } from '@soundtouchjs/audio-worklet'

type PositionListener = (seconds: number) => void

/** SoundTouch worklet processor (pure JS), copied to `public/`. */
const SOUNDTOUCH_PROCESSOR_URL = '/soundtouch-processor.js'

/** One loaded stem: its decoded buffer and the gain node feeding the master bus. */
interface StemNode {
  readonly id: string
  readonly buffer: AudioBuffer
  readonly gain: GainNode
  source: AudioBufferSourceNode | undefined
}

/**
 * Driven adapter for the `StemPlaybackEngine` port — the multitrack sibling of
 * `createWebAudioPlayback`. Each stem plays through its own `GainNode`; all the
 * gains sum into one SoundTouch master bus so tempo/pitch move on the whole mix
 * (and stay in sync, since every source shares the same `playbackRate`, start
 * offset and start time). The mixer drives `setGain` per channel.
 *
 * Position is derived from `AudioContext.currentTime` scaled by the tempo ratio,
 * exactly as the single-track engine does. Untested (jsdom has no Web Audio /
 * AudioWorklet) — a humble object verified in a real browser.
 */
export function createWebAudioStemPlayback(): StemPlaybackEngine {
  const listeners = new Set<PositionListener>()
  // Desired linear gains by stem id, kept so `setGain` works before `load` and
  // every (re)created gain node can adopt the current value.
  const desiredGains = new Map<string, number>()
  let context: AudioContext | undefined
  let stretch: SoundTouchNode | undefined
  let stems: StemNode[] = []
  let durationSeconds = 0
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
    const ctx = audioContext()
    try {
      const { SoundTouchNode } = await import('@soundtouchjs/audio-worklet')
      await SoundTouchNode.register(ctx, SOUNDTOUCH_PROCESSOR_URL)
      const node = new SoundTouchNode({ context: ctx })
      node.connect(ctx.destination)
      node.playbackRate.value = timeRatio
      node.pitchSemitones.value = pitchSemitones
      stretch = node
    } catch {
      // No worklet → the stems still sum to the destination, only tempo/pitch go
      // inert. Verified/fixed in the browser.
      stretch = undefined
    }
  }

  function outputNode(): AudioNode {
    return stretch ?? audioContext().destination
  }

  function position(): number {
    const raw = isPlaying
      ? startOffset + timeRatio * (audioContext().currentTime - startedAt)
      : startOffset
    return Math.min(Math.max(raw, 0), durationSeconds)
  }

  function emit(): void {
    if (stems.length === 0) {
      return
    }
    const seconds = position()
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

  function stopSources(): void {
    for (const stem of stems) {
      if (stem.source) {
        stem.source.onended = null
        stem.source.stop()
        stem.source.disconnect()
        stem.source = undefined
      }
    }
    if (frame !== undefined) {
      cancelAnimationFrame(frame)
      frame = undefined
    }
  }

  function startSources(offset: number): void {
    const ctx = audioContext()
    startOffset = offset
    startedAt = ctx.currentTime
    isPlaying = true
    stems.forEach((stem, index) => {
      const node = ctx.createBufferSource()
      node.buffer = stem.buffer
      node.playbackRate.value = timeRatio
      node.connect(stem.gain)
      // Only the first stem ends the transport, so the natural-end handler fires
      // once (all stems share a length and start together).
      if (index === 0) {
        node.onended = () => {
          if (stem.source === node) {
            stopSources()
            isPlaying = false
            startOffset = durationSeconds
            emit()
          }
        }
      }
      node.start(0, offset)
      stem.source = node
    })
    frame = requestAnimationFrame(loop)
  }

  function makeBuffer(audio: StemSource['audio']): AudioBuffer {
    const channelCount = Math.max(audio.channels.length, 1)
    const frames = Math.max(audio.channels[0]?.length ?? 0, 1)
    const buf = audioContext().createBuffer(
      channelCount,
      frames,
      audio.sampleRate
    )
    audio.channels.forEach((channel, index) => {
      buf.copyToChannel(Float32Array.from(channel as ArrayLike<number>), index)
    })
    return buf
  }

  return {
    async load(sources: readonly StemSource[]): Promise<void> {
      stopSources()
      isPlaying = false
      startOffset = 0
      await ensureStretch()
      const ctx = audioContext()
      stems = sources.map((source) => {
        const gain = ctx.createGain()
        // Adopt any gain the mixer set before load; default to unity.
        gain.gain.value = desiredGains.get(source.id) ?? 1
        gain.connect(outputNode())
        return {
          id: source.id,
          buffer: makeBuffer(source.audio),
          gain,
          source: undefined
        }
      })
      durationSeconds = stems.reduce(
        (max, stem) => Math.max(max, stem.buffer.duration),
        0
      )
      emit()
    },

    async addStem(source: StemSource): Promise<void> {
      await ensureStretch()
      const ctx = audioContext()
      const gain = ctx.createGain()
      gain.gain.value = desiredGains.get(source.id) ?? 1
      gain.connect(outputNode())
      const stem: StemNode = {
        id: source.id,
        buffer: makeBuffer(source.audio),
        gain,
        source: undefined
      }
      stems.push(stem)
      durationSeconds = Math.max(durationSeconds, stem.buffer.duration)
      // Joining a running mix: start this one buffer at the live position so it
      // lines up with the others (never index 0, so it never owns the end).
      if (isPlaying) {
        const node = ctx.createBufferSource()
        node.buffer = stem.buffer
        node.playbackRate.value = timeRatio
        node.connect(stem.gain)
        node.start(0, position())
        stem.source = node
      }
      emit()
    },

    removeStem(id: string): void {
      const index = stems.findIndex((stem) => stem.id === id)
      if (index === -1) {
        return
      }
      const [removed] = stems.splice(index, 1)
      if (removed?.source) {
        removed.source.onended = null
        removed.source.stop()
        removed.source.disconnect()
      }
      removed?.gain.disconnect()
      durationSeconds = stems.reduce(
        (max, stem) => Math.max(max, stem.buffer.duration),
        0
      )
    },

    play(): void {
      if (stems.length === 0 || isPlaying) {
        return
      }
      void audioContext().resume()
      // Replaying from the very end restarts from the top.
      const offset = startOffset >= durationSeconds ? 0 : startOffset
      startSources(offset)
    },

    pause(): void {
      if (stems.length === 0 || !isPlaying) {
        return
      }
      const at = position()
      stopSources()
      isPlaying = false
      startOffset = at
      emit()
    },

    seekTo(seconds: number): void {
      if (stems.length === 0) {
        return
      }
      const target = Math.min(Math.max(seconds, 0), durationSeconds)
      if (isPlaying) {
        stopSources()
        startSources(target)
      } else {
        startOffset = target
        emit()
      }
    },

    setTimeRatio(ratio: number): void {
      // Re-baseline the position before changing the scale, so the elapsed-time
      // maths stays continuous across the ratio change.
      if (stems.length > 0 && isPlaying) {
        startOffset = position()
        startedAt = audioContext().currentTime
      }
      timeRatio = ratio
      for (const stem of stems) {
        if (stem.source) {
          stem.source.playbackRate.value = ratio
        }
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

    setGain(id: string, gain: number): void {
      desiredGains.set(id, gain)
      const stem = stems.find((candidate) => candidate.id === id)
      if (stem) {
        stem.gain.gain.value = gain
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
