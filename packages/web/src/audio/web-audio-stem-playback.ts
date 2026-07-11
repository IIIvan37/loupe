import type { StemPlaybackEngine, StemSource } from '@app/core'
import { audioBufferFrom, createStretchTransport } from './web-audio-shared.ts'

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
 * The context, stretch bus and position clock live in the shared
 * `StretchTransport`, exactly as in the single-track engine; only the
 * per-stem source/gain management is this engine's own. Untested (jsdom has
 * no Web Audio / AudioWorklet) — a humble object verified in a real browser.
 */
export function createWebAudioStemPlayback(): StemPlaybackEngine {
  // Desired linear gains by stem id, kept so `setGain` works before `load` and
  // every (re)created gain node can adopt the current value.
  const desiredGains = new Map<string, number>()
  let stems: StemNode[] = []
  let durationSeconds = 0
  const transport = createStretchTransport(() =>
    stems.length === 0 ? undefined : durationSeconds
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

  function makeStem(source: StemSource): StemNode {
    const ctx = transport.audioContext()
    const gain = ctx.createGain()
    // Adopt any gain the mixer set before load; default to unity.
    gain.gain.value = desiredGains.get(source.id) ?? 1
    gain.connect(transport.outputNode())
    return {
      id: source.id,
      buffer: audioBufferFrom(ctx, source.audio),
      gain,
      source: undefined
    }
  }

  function longestDuration(): number {
    return stems.reduce((max, stem) => Math.max(max, stem.buffer.duration), 0)
  }

  return {
    async load(sources: readonly StemSource[]): Promise<void> {
      stopSources()
      transport.stopAt(0)
      await transport.ensureStretch()
      stems = sources.map(makeStem)
      durationSeconds = longestDuration()
      transport.emit()
    },

    async addStem(source: StemSource): Promise<void> {
      await transport.ensureStretch()
      const stem = makeStem(source)
      stems.push(stem)
      durationSeconds = Math.max(durationSeconds, stem.buffer.duration)
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

    onPositionChange: transport.onPositionChange
  }
}
