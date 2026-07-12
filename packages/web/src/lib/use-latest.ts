import { type RefObject, useEffect, useRef } from 'react'

/**
 * The "latest ref" idiom, render-pure: a ref that always holds the value of
 * the last COMMITTED render, written in an effect (never during render, which
 * React may replay or discard). For mount-once listeners and async handlers
 * that must read fresh props/state without re-subscribing — all of which fire
 * after commit, so the effect-written value is never stale for them.
 */
export function useLatest<T>(value: T): RefObject<T> {
  const ref = useRef(value)
  useEffect(() => {
    ref.current = value
  })
  return ref
}
