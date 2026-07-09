import { type CountIn, synthesizeClickTrack } from '@app/core'
import type { CountInPlayer } from '../app/tempo/use-count-in.ts'
import { audioBufferFrom } from './web-audio-shared.ts'

/** Slack past the bar before the wall-clock fallback declares the count over. */
const FALLBACK_SLACK_MS = 150

/**
 * The real Web Audio count-in player: synthesize one bar of clicks into a
 * buffer and play it once, straight to the destination (the count-in is not
 * part of the mix — it must sound even before the engines start). The deferred
 * start fires on the source's `onended`, with a wall-clock timer slightly past
 * the bar as a safety net: an autoplay-suspended context never plays the buffer
 * (so `onended` never comes), and the count-in must degrade to a plain start,
 * not hang the transport. Whichever fires first wins; cancelling silences both.
 * Untestable humble object (jsdom has no AudioContext) — browser-verified.
 */
export function createCountInPlayer(): CountInPlayer {
  let ctx: AudioContext | undefined
  return {
    play(countIn: CountIn, onEnded: () => void): () => void {
      ctx ??= new AudioContext()
      // An autoplay-suspended context would swallow the clicks silently.
      void ctx.resume().catch(() => {})
      const samples = synthesizeClickTrack({
        beats: countIn.beats,
        durationSeconds: countIn.durationSeconds,
        sampleRate: ctx.sampleRate
      })
      const source = ctx.createBufferSource()
      source.buffer = audioBufferFrom(ctx, {
        sampleRate: ctx.sampleRate,
        channels: [samples]
      })
      source.connect(ctx.destination)
      let done = false
      const finish = (): void => {
        if (!done) {
          done = true
          onEnded()
        }
      }
      const fallback = window.setTimeout(
        () => {
          finish()
          // Stop the source too: a context resuming later would otherwise play
          // the queued clicks late, over the running track.
          source.stop()
        },
        countIn.durationSeconds * 1000 + FALLBACK_SLACK_MS
      )
      source.onended = () => {
        source.disconnect()
        window.clearTimeout(fallback)
        finish()
      }
      source.start()
      return () => {
        done = true
        window.clearTimeout(fallback)
        source.stop()
      }
    }
  }
}
