import {
  type DecodedAudio,
  type SpectrumFrame,
  spectrumFromSamples
} from '@app/core'
import type { SoundTouchNode } from '@soundtouchjs/audio-worklet'
import { recallAudioBuffer } from './audio-buffer-memo.ts'
import { mixWindow } from './mix-window.ts'

/** SoundTouch worklet processor (pure JS), copied to `public/`. */
const SOUNDTOUCH_PROCESSOR_URL = '/soundtouch-processor.js'

/** One FFT size for both spectrum sources: the live analyser tap and the
 * paused window — ~10.8 Hz bins at 44.1 kHz, a semitone wide from ~C2 up. */
const FFT_SIZE = 4096

/** The tempo/pitch shift a SoundTouch master node applies to its input. */
interface StretchParams {
  readonly timeRatio: number
  readonly pitchSemitones: number
}

type PositionListener = (seconds: number) => void

/**
 * A Web Audio buffer carrying `audio`'s PCM: the SHARED decode buffer when the
 * decoder registered one (V.5 — may come from another context, which source
 * nodes accept), else a fresh copy built on `ctx`. Callers must treat the
 * result as READ-ONLY — a write into a shared buffer would be audible and
 * corrupt every analysis. Shared by the playback adapters and the offline
 * analysis resampler. At least one channel and one frame keep `createBuffer`
 * from throwing on silence.
 */
export function audioBufferFrom(
  ctx: BaseAudioContext,
  audio: DecodedAudio
): AudioBuffer {
  // The decode buffer this audio is views into, when the decoder produced it
  // (V.5): sharing it skips the ~88 MB copy — see audio-buffer-memo.ts for
  // the read-only contract.
  const remembered = recallAudioBuffer(audio)
  if (remembered) {
    return remembered
  }
  const channelCount = Math.max(audio.channels.length, 1)
  const frames = Math.max(audio.channels[0]?.length ?? 0, 1)
  const buffer = ctx.createBuffer(channelCount, frames, audio.sampleRate)
  audio.channels.forEach((channel, index) => {
    // Decoded channels already are Float32Arrays — converting again would copy
    // the whole channel transiently (~tens of MB per stem) for nothing.
    const samples =
      channel instanceof Float32Array
        ? // The runtime never hands a SharedArrayBuffer-backed channel here;
          // the assertion only bridges TS's `ArrayBufferLike` default.
          (channel as Float32Array<ArrayBuffer>)
        : Float32Array.from(channel as ArrayLike<number>)
    buffer.copyToChannel(samples, index)
  })
  return buffer
}

/**
 * The paused twin of the analyser tap's `spectrum()`: one FFT frame of the
 * given buffers mixed as the tap would hear them (channels averaged, layers
 * gain-weighted and summed) at `seconds`. The engines feed this to the
 * transport so the Spectre tab follows paused navigation (seek, measure
 * click) instead of going dark. Reads only — the buffers may be the shared
 * decode buffer (V.5 contract).
 */
export function pausedSpectrumFrame(
  layers: ReadonlyArray<{
    readonly buffer: AudioBuffer
    readonly gain: number
  }>,
  seconds: number
): SpectrumFrame | undefined {
  const sampleRate = layers[0]?.buffer.sampleRate
  if (sampleRate === undefined) {
    return undefined
  }
  const window = mixWindow(
    layers.map(({ buffer, gain }) => ({
      channels: decodedAudioFrom(buffer).channels,
      gain
    })),
    Math.floor(seconds * sampleRate),
    FFT_SIZE
  )
  return spectrumFromSamples(window, sampleRate)
}

/**
 * Read a Web Audio buffer back as decoded PCM — the inverse of
 * `audioBufferFrom`, shared by the file decoder and the stem engine's
 * `stemAudio`. The channels are zero-copy views into the buffer's own storage.
 */
export function decodedAudioFrom(buffer: AudioBuffer): DecodedAudio {
  const channels: Float32Array[] = []
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    channels.push(buffer.getChannelData(channel))
  }
  return { sampleRate: buffer.sampleRate, channels }
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
  sink: AudioNode,
  params: StretchParams
): Promise<SoundTouchNode | undefined> {
  try {
    // Loaded lazily (browser only): the worklet class extends AudioWorkletNode,
    // which does not exist in the test/node path.
    const { SoundTouchNode } = await import('@soundtouchjs/audio-worklet')
    await SoundTouchNode.register(ctx, SOUNDTOUCH_PROCESSOR_URL)
    const node = new SoundTouchNode({ context: ctx })
    node.connect(sink)
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
  /** Where engine nodes plug in: the stretch bus, or the analyser tap. */
  outputNode(): AudioNode
  /** One read of the audible output's spectrum (linear magnitudes). */
  spectrum(): SpectrumFrame | undefined
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
  durationOf: () => number | undefined,
  /**
   * The paused twin of the analyser tap: the engine computes one spectrum
   * frame from its OWN buffers at `seconds` (the tap is silent at rest).
   * Absent — no buffer access (test fakes) — the paused spectrum reads
   * undefined, exactly the pre-pause behaviour.
   */
  pausedSpectrum?: (seconds: number) => SpectrumFrame | undefined
): StretchTransport {
  const listeners = new Set<PositionListener>()
  let context: AudioContext | undefined
  let stretch: SoundTouchNode | undefined
  let stretchLoading: Promise<SoundTouchNode | undefined> | undefined
  let frame: number | undefined
  let isPlaying = false
  // Position bookkeeping: where the current run started, and the context clock at
  // that moment. Live position = startOffset + ratio * (now - startedAt).
  let startOffset = 0
  let startedAt = 0
  let timeRatio = 1
  let pitchSemitones = 0
  // Everything audible flows destination-ward through this pass-through
  // analyser — the Spectre tab's one tap on the mix.
  let tap: AnalyserNode | undefined

  function audioContext(): AudioContext {
    context ??= new AudioContext()
    return context
  }

  function analyserTap(): AnalyserNode {
    if (!tap) {
      const ctx = audioContext()
      tap = ctx.createAnalyser()
      tap.fftSize = FFT_SIZE
      tap.connect(ctx.destination)
    }
    return tap
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
      // Concurrent callers on a cold context (a load racing an addStem) must
      // share ONE registration — a second SoundTouchNode would stay wired to
      // the destination forever and split the mix across two buses.
      // No worklet → basic playback still works (sources → destination), only
      // the tempo/pitch controls go inert. Verified/fixed in the browser.
      stretchLoading ??= loadSoundTouchNode(audioContext(), analyserTap(), {
        timeRatio,
        pitchSemitones
      })
      stretch = await stretchLoading
      // The controls may have moved while the worklet registered.
      if (stretch) {
        stretch.playbackRate.value = timeRatio
        stretch.pitchSemitones.value = pitchSemitones
      }
    },

    outputNode(): AudioNode {
      return stretch ?? analyserTap()
    },

    spectrum(): SpectrumFrame | undefined {
      // At rest the tap reads silence — the engine's paused twin computes the
      // frame from the decoded buffers at the playhead instead (point 2 of
      // the pre-beta UI lot: the Spectre must follow paused navigation).
      if (!isPlaying) {
        return pausedSpectrum?.(position())
      }
      if (!tap) {
        return undefined
      }
      const dbs = new Float32Array(tap.frequencyBinCount)
      tap.getFloatFrequencyData(dbs)
      // dBFS → linear magnitude; -Infinity (silence) lands on 0.
      const magnitudes = new Float32Array(dbs.length)
      for (let i = 0; i < dbs.length; i++) {
        const db = dbs[i] ?? Number.NEGATIVE_INFINITY
        magnitudes[i] = db === Number.NEGATIVE_INFINITY ? 0 : 10 ** (db / 20)
      }
      return { magnitudes, sampleRate: audioContext().sampleRate }
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
