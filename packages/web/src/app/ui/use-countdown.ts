import { useCallback, useEffect, useRef, useState } from 'react'

/** A one-shot seconds countdown. `start(n)` sets `secondsLeft` to n and ticks it
 * down to 0 once a second; the interval is cleared at zero and on unmount. Used
 * for the magic-link resend cooldown (AK.1) — modelled on `use-two-step-confirm`
 * (timer in a ref, cleaned up so it never fires into a gone component). */
export interface Countdown {
  readonly secondsLeft: number
  readonly start: (seconds: number) => void
}

export function useCountdown(): Countdown {
  const [secondsLeft, setSecondsLeft] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined)

  const clear = useCallback(() => {
    if (timerRef.current !== undefined) {
      clearInterval(timerRef.current)
      timerRef.current = undefined
    }
  }, [])

  const start = useCallback(
    (seconds: number) => {
      clear()
      setSecondsLeft(seconds)
      timerRef.current = setInterval(() => {
        setSecondsLeft((n) => Math.max(0, n - 1))
      }, 1000)
    },
    [clear]
  )

  // Stop ticking once it reaches zero — no point running an idle interval.
  useEffect(() => {
    if (secondsLeft === 0) {
      clear()
    }
  }, [secondsLeft, clear])

  // Belt-and-braces: never leave an interval running past unmount.
  useEffect(() => clear, [clear])

  return { secondsLeft, start }
}
