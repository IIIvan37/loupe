import { type CountIn, synthesizeClickTrack } from '@app/core'
import type { CountInPlayer } from '../app/tempo/use-count-in.ts'
import { audioBufferFrom } from './web-audio-shared.ts'

/**
 * The real Web Audio count-in player: synthesize the counts into a buffer and
 * play it once, straight to the destination (the count-in is not part of the
 * mix — it must sound even before the engines start). The buffer spans the
 * whole bar, so its silent last interval leads into the landing — the track's
 * own click, not ours. The deferred start fires on a wall-clock timer at
 * `durationSeconds` exactly; it fires even when an autoplay-suspended context
 * never plays a sample, degrading to a plain start instead of hanging the
 * transport. `onended` is only cleanup plus a done-guarded safety net.
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
      const start = window.setTimeout(() => {
        finish()
        // A context still suspended here never sounded a sample — stop the
        // queued source so a late resume can't click over the running track.
        // A running context keeps ringing its landing click to the buffer end.
        if (ctx?.state !== 'running') {
          source.stop()
        }
      }, countIn.durationSeconds * 1000)
      source.onended = () => {
        source.disconnect()
        // Safety net: had the timer somehow not fired, the count still ends.
        finish()
      }
      source.start()
      return () => {
        done = true
        window.clearTimeout(start)
        source.stop()
      }
    }
  }
}
