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
      <svg
        className={styles.ring}
        viewBox="0 0 64 64"
        aria-hidden="true"
        focusable="false"
      >
        <path
          d="M 43.47 15.62 A 20 20 0 1 1 20.53 15.62"
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <polygon points="27.9,10.2 23.4,21.6 15.9,10.9" fill="currentColor" />
      </svg>
      <span aria-hidden="true">upe</span>
    </span>
  )
}
