import { useEffect, useRef } from 'react'
import controls from './controls.module.css'

interface LiveStatusProps {
  /** What the screen reader should say next — undefined announces nothing. */
  readonly message: string | undefined
}

/**
 * Persistent screen-reader announcement channel: a visually-hidden
 * `role="status"` region. Live regions only speak content that changes AFTER
 * they exist in the DOM, so the text is written from an effect — the first
 * paint mounts the region empty and the mutation is what gets announced, even
 * when the consumer mounts with a message already in hand (e.g. a panel that
 * appears at the same instant the operation it narrates starts). The screen
 * reader is the external system the effect synchronises; React never renders
 * children here, so the direct write does not fight reconciliation. Keep the
 * component mounted for the whole flow it narrates: unmounting silences the
 * change.
 */
export function LiveStatus({ message }: LiveStatusProps) {
  const region = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (region.current !== null) {
      region.current.textContent = message ?? ''
    }
  }, [message])
  return <span ref={region} role="status" className={controls.srOnly} />
}
