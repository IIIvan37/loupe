import { LoopMark } from '../ui/loop-mark.tsx'
import styles from './logo-wordmark.module.css'

/**
 * The brand wordmark: « Loupe » set in the logo face, its « o » replaced by
 * the amber A→B loop ring — the same mark the favicon carries alone. One
 * accessible image named « Loupe »; the letter glyphs and the ring are
 * drawing, not text, so they stay out of the accessibility tree.
 */
export function LogoWordmark() {
  return (
    <span className={styles.wordmark} role="img" aria-label="Loupe">
      <span aria-hidden="true">L</span>
      <LoopMark className={styles.ring} />
      <span aria-hidden="true">upe</span>
    </span>
  )
}
