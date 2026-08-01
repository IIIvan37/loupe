/**
 * The brand mark: an open ring whose arrow jumps the gap back to the start —
 * the way playback jumps from marker B back to marker A. Same artwork as
 * `public/favicon.svg`. Paints in `currentColor` so the host picks the accent
 * (amber = the active loop, the app's own semantic); decorative by contract,
 * like the Icon vocabulary — the host carries any accessible name.
 */
export function LoopMark({
  className
}: {
  readonly className?: string | undefined
}) {
  return (
    <svg
      className={className}
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
  )
}
