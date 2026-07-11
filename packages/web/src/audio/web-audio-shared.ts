import type { DecodedAudio } from '@app/core'
import type { SoundTouchNode } from '@soundtouchjs/audio-worklet'

/** SoundTouch worklet processor (pure JS), copied to `public/`. */
const SOUNDTOUCH_PROCESSOR_URL = '/soundtouch-processor.js'

/** The tempo/pitch shift a SoundTouch master node applies to its input. */
interface StretchParams {
  readonly timeRatio: number
  readonly pitchSemitones: number
}

type PositionListener = (seconds: number) => void

/**
 * Copy decoded PCM into a Web Audio buffer on the given context. Shared by the
 * single-track and stem playback adapters, which fill buffers identically. At
 * least one channel and one frame keep `createBuffer` from throwing on silence.
 */
export function audioBufferFrom(
  ctx: AudioContext,
  audio: DecodedAudio
): AudioBuffer {
  const channelCount = Math.max(audio.channels.length, 1)
  const frames = Math.max(audio.channels[0]?.length ?? 0, 1)
  const buffer = ctx.createBuffer(channelCount, frames, audio.sampleRate)
  audio.channels.forEach((channel, index) => {
    buffer.copyToChannel(Float32Array.from(channel as ArrayLike<number>), index)
  })
  return buffer
}

/**
 * Lazily build the SoundTouch master node — register the worklet, connect it to
 * the destination and apply the current tempo/pitch. Returns `undefined` when the
 * worklet is unavailable (node/test path, or a load failure), so both adapters
 * fall back to plain output with the tempo/pitch controls inert. Untested (jsdom
 * has no AudioWorklet) — verified in a real browser.
 */
async function loadSoundTouchNode(
  ctx: AudioContext,
  params: StretchParams
): Promise<SoundTouchNode | undefined> {
  try {
    // Loaded lazily (browser only): the worklet class extends AudioWorkletNode,
    // which does not exist in the test/node path.
    const { SoundTouchNode } = await import('@soundtouchjs/audio-worklet')
    await SoundTouchNode.register(ctx, SOUNDTOUCH_PROCESSOR_URL)
    const node = new SoundTouchNode({ context: ctx })
    node.connect(ctx.destination)
    node.playbackRate.value = params.timeRatio
    node.pitchSemitones.value = params.pitchSemitones
    return node
  } catch {
    return undefined
  }
}

/**
 * The transport chassis shared by the single-track and stem playback engines:
 * the lazy `AudioContext`, the SoundTouch master bus, tempo/pitch state and
 * the position clock (start-offset/start-time bookkeeping plus the rAF emit
 * loop). Engines keep only what differs — their source-node management.
 */
interface StretchTransport {
  audioContext(): AudioContext
  /** Lazily create the SoundTouch node; on failure, fall back to plain output. */
  ensureStretch(): Promise<void>
  /** Where engine nodes plug in: the stretch bus, or the bare destination. */
  outputNode(): AudioNode
  timeRatio(): number
  isPlaying(): boolean
  /** Live position, clamped to the media duration. */
  position(): number
  /** Push the current position to every listener (no-op while nothing is loaded). */
  emit(): void
  /** Mark a run started at `offset` and drive the rAF position loop. */
  beginRun(offset: number): void
  /** Cancel the rAF loop — source teardown stays with the engine. */
  cancelFrame(): void
  /** Halt the clock at `seconds` (load reset, pause, seek-at-rest, natural end). */
  stopAt(seconds: number): void
  /** Re-baseline, store the ratio, and let the engine mirror it on its sources. */
  setTimeRatio(ratio: number, applyToSources: (ratio: number) => void): void
  setPitchSemitones(semitones: number): void
  onPositionChange(listener: PositionListener): () => void
}

/**
 * `durationOf` returns the loaded media's duration, or `undefined` while
 * nothing is loaded — the emit loop then stays silent, exactly as both engines
 * guarded before extraction. Untested (jsdom has no Web Audio) — a humble
 * object verified in a real browser, like the engines composing it.
 */
export function createStretchTransport(
  durationOf: () => number | undefined
): StretchTransport {
  const listeners = new Set<PositionListener>()
  let context: AudioContext | undefined
  let stretch: SoundTouchNode | undefined
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

  function position(): number {
    const raw = isPlaying
      ? startOffset + timeRatio * (audioContext().currentTime - startedAt)
      : startOffset
    return Math.min(Math.max(raw, 0), durationOf() ?? 0)
  }

  function emit(): void {
    if (durationOf() === undefined) {
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

  return {
    audioContext,

    async ensureStretch(): Promise<void> {
      if (stretch) {
        return
      }
      // No worklet → basic playback still works (sources → destination), only
      // the tempo/pitch controls go inert. Verified/fixed in the browser.
      stretch = await loadSoundTouchNode(audioContext(), {
        timeRatio,
        pitchSemitones
      })
    },

    outputNode(): AudioNode {
      return stretch ?? audioContext().destination
    },

    timeRatio: () => timeRatio,
    isPlaying: () => isPlaying,
    position,
    emit,

    beginRun(offset: number): void {
      startOffset = offset
      startedAt = audioContext().currentTime
      isPlaying = true
      frame = requestAnimationFrame(loop)
    },

    cancelFrame(): void {
      if (frame !== undefined) {
        cancelAnimationFrame(frame)
        frame = undefined
      }
    },

    stopAt(seconds: number): void {
      isPlaying = false
      startOffset = seconds
    },

    setTimeRatio(ratio: number, applyToSources: (ratio: number) => void): void {
      // Re-baseline the position before changing the scale, so the elapsed-time
      // maths stays continuous across the ratio change.
      if (durationOf() !== undefined && isPlaying) {
        startOffset = position()
        startedAt = audioContext().currentTime
      }
      timeRatio = ratio
      applyToSources(ratio)
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
