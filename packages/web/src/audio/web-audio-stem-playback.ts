import type {
  DecodedAudio,
  StemFilter,
  StemPlaybackEngine,
  StemSource
} from '@app/core'
import {
  audioBufferFrom,
  createStretchTransport,
  decodedAudioFrom,
  pausedSpectrumFrame
} from './web-audio-shared.ts'

/** One loaded stem: its decoded buffer and the gain → high-cut-low chain
 * feeding the master bus (source → gain → highpass → lowpass → bus). */
interface StemNode {
  readonly id: string
  readonly buffer: AudioBuffer
  readonly gain: GainNode
  /** Low-cut: a highpass, parked at 0 Hz (flat) until a filter is set. */
  readonly high: BiquadFilterNode
  /** High-cut: a lowpass, parked at Nyquist (flat) until a filter is set. */
  readonly low: BiquadFilterNode
  source: AudioBufferSourceNode | undefined
}

/**
 * Driven adapter for the `StemPlaybackEngine` port — the multitrack sibling of
 * `createWebAudioPlayback`. Each stem plays through its own `GainNode`; all the
 * gains sum into one SoundTouch master bus so tempo/pitch move on the whole mix
 * (and stay in sync, since every source shares the same `playbackRate`, start
 * offset and start time). The mixer drives `setGain` per channel.
 *
 * The context, stretch bus and position clock live in the shared
 * `StretchTransport`, exactly as in the single-track engine; only the
 * per-stem source/gain management is this engine's own. Untested (jsdom has
 * no Web Audio / AudioWorklet) — a humble object verified in a real browser.
 */
export function createWebAudioStemPlayback(): StemPlaybackEngine {
  // Desired linear gains by stem id, kept so `setGain` works before `load` and
  // every (re)created gain node can adopt the current value.
  const desiredGains = new Map<string, number>()
  // Desired tone filters by stem id — same lifecycle as the gains.
  const desiredFilters = new Map<string, StemFilter>()
  let stems: StemNode[] = []
  let durationSeconds = 0
  // Bumped by every load: an async tail (worklet registration) that resumes
  // after a newer load must not wire its now-discarded nodes into the graph.
  let loadToken = 0
  const transport = createStretchTransport(
    () => (stems.length === 0 ? undefined : durationSeconds),
    // Paused Spectre: the stems mixed at their fader gains — what the tap
    // would hear at the playhead (a muted stem stays out of the picture).
    (seconds) =>
      stems.length === 0
        ? undefined
        : pausedSpectrumFrame(
            stems.map((stem) => ({
              buffer: stem.buffer,
              gain: desiredGains.get(stem.id) ?? 1
            })),
            seconds
          )
  )

  function stopSources(): void {
    for (const stem of stems) {
      if (stem.source) {
        stem.source.onended = null
        stem.source.stop()
        stem.source.disconnect()
        stem.source = undefined
      }
    }
    transport.cancelFrame()
  }

  function startSources(offset: number): void {
    const ctx = transport.audioContext()
    transport.beginRun(offset)
    stems.forEach((stem, index) => {
      const node = ctx.createBufferSource()
      node.buffer = stem.buffer
      node.playbackRate.value = transport.timeRatio()
      node.connect(stem.gain)
      // Only the first stem ends the transport, so the natural-end handler fires
      // once (all stems share a length and start together).
      if (index === 0) {
        node.onended = () => {
          if (stem.source === node) {
            stopSources()
            transport.stopAt(durationSeconds)
            transport.emit()
          }
        }
      }
      node.start(0, offset)
      stem.source = node
    })
  }

  // Build the stem's buffer and gain WITHOUT connecting the gain — wiring waits
  // for the stretch bus, so callers connect after `ensureStretch` resolves.
  /** Aim both biquads at the stem's desired filter (absent side = flat). */
  function aimFilter(stem: StemNode): void {
    const filter = desiredFilters.get(stem.id)
    const nyquist = transport.audioContext().sampleRate / 2
    stem.high.frequency.value = Math.min(filter?.lowCutHz ?? 0, nyquist)
    stem.low.frequency.value = Math.min(filter?.highCutHz ?? nyquist, nyquist)
  }

  function makeStem(source: StemSource): StemNode {
    const ctx = transport.audioContext()
    const gain = ctx.createGain()
    // Adopt any gain the mixer set before load; default to unity.
    gain.gain.value = desiredGains.get(source.id) ?? 1
    // The tone chain is always present, parked flat — setting a filter only
    // moves a frequency, never rewires the graph. Butterworth Q (no bump).
    const high = ctx.createBiquadFilter()
    high.type = 'highpass'
    high.Q.value = Math.SQRT1_2
    const low = ctx.createBiquadFilter()
    low.type = 'lowpass'
    low.Q.value = Math.SQRT1_2
    gain.connect(high)
    high.connect(low)
    const stem: StemNode = {
      id: source.id,
      buffer: audioBufferFrom(ctx, source.audio),
      gain,
      high,
      low,
      source: undefined
    }
    aimFilter(stem)
    return stem
  }

  function longestDuration(): number {
    return stems.reduce((max, stem) => Math.max(max, stem.buffer.duration), 0)
  }

  return {
    async load(sources: readonly StemSource[]): Promise<void> {
      const token = ++loadToken
      stopSources()
      transport.stopAt(0)
      // A load starts a fresh mix: forget the previous track's per-id gains so
      // same-named stems (voix, batterie…) don't inherit yesterday's faders —
      // a restore pushes its saved gains right after this call.
      desiredGains.clear()
      desiredFilters.clear()
      // Adopt the buffers BEFORE awaiting the stretch bus: `stemAudio` must
      // serve export/save from the moment the load is handed over — the caller
      // releases its own copy of the PCM right after this call.
      stems = sources.map(makeStem)
      durationSeconds = longestDuration()
      await transport.ensureStretch()
      if (token !== loadToken) {
        return
      }
      for (const stem of stems) {
        stem.low.connect(transport.outputNode())
      }
      transport.emit()
    },

    async addStem(source: StemSource): Promise<void> {
      const stem = makeStem(source)
      stems.push(stem)
      durationSeconds = Math.max(durationSeconds, stem.buffer.duration)
      await transport.ensureStretch()
      // The stem may be gone by now — a removeStem (metronome reseat) or a
      // wholesale load while the worklet registered. Wiring it anyway would
      // start a ghost source no later call could ever reach again.
      if (!stems.includes(stem)) {
        return
      }
      stem.low.connect(transport.outputNode())
      // Joining a running mix: start this one buffer at the live position so it
      // lines up with the others (never index 0, so it never owns the end).
      if (transport.isPlaying()) {
        const node = transport.audioContext().createBufferSource()
        node.buffer = stem.buffer
        node.playbackRate.value = transport.timeRatio()
        node.connect(stem.gain)
        node.start(0, transport.position())
        stem.source = node
      }
      transport.emit()
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
      removed?.high.disconnect()
      removed?.low.disconnect()
      durationSeconds = longestDuration()
    },

    play(): void {
      if (stems.length === 0 || transport.isPlaying()) {
        return
      }
      void transport.audioContext().resume()
      // Replaying from the very end restarts from the top.
      const resting = transport.position()
      startSources(resting >= durationSeconds ? 0 : resting)
    },

    pause(): void {
      if (stems.length === 0 || !transport.isPlaying()) {
        return
      }
      const at = transport.position()
      stopSources()
      transport.stopAt(at)
      transport.emit()
    },

    seekTo(seconds: number): void {
      if (stems.length === 0) {
        return
      }
      const target = Math.min(Math.max(seconds, 0), durationSeconds)
      if (transport.isPlaying()) {
        stopSources()
        startSources(target)
      } else {
        transport.stopAt(target)
        transport.emit()
      }
    },

    setTimeRatio(ratio: number): void {
      transport.setTimeRatio(ratio, (value) => {
        for (const stem of stems) {
          if (stem.source) {
            stem.source.playbackRate.value = value
          }
        }
      })
    },

    setPitchSemitones(semitones: number): void {
      transport.setPitchSemitones(semitones)
    },

    setGain(id: string, gain: number): void {
      desiredGains.set(id, gain)
      const stem = stems.find((candidate) => candidate.id === id)
      if (stem) {
        stem.gain.gain.value = gain
      }
    },

    stemAudio(id: string): DecodedAudio | undefined {
      const stem = stems.find((candidate) => candidate.id === id)
      // Zero-copy views into the engine's own buffers — the ONE retained form
      // of the stems' PCM (export and save re-derive the samples from here).
      return stem ? decodedAudioFrom(stem.buffer) : undefined
    },

    onPositionChange: transport.onPositionChange,
    spectrum: transport.spectrum,

    setStemFilter(id: string, filter: StemFilter): void {
      desiredFilters.set(id, filter)
      const stem = stems.find((entry) => entry.id === id)
      if (stem) {
        aimFilter(stem)
      }
    }
  }
}
