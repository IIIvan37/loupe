import type { ReactNode } from 'react'

/**
 * The inline-icon vocabulary. Text glyphs (`✎ ✕ ⏮ ▶ ⟳`) render inconsistently
 * across platforms and fonts; these are the semantic names we draw ourselves.
 */
export type IconName =
  | 'skip-back'
  | 'play'
  | 'pause'
  | 'skip-forward'
  | 'edit'
  | 'close'
  | 'loop'

/**
 * The per-name artwork, on a 24×24 grid. Transport marks are filled (the media
 * convention); the rest are stroked (Feather-like). Everything paints in
 * `currentColor`, so an icon takes the colour of its host button.
 */
const glyphs: Record<IconName, ReactNode> = {
  'skip-back': (
    <path fill="currentColor" stroke="none" d="M8 6h2v12H8zM20 6v12l-9-6z" />
  ),
  play: <path fill="currentColor" stroke="none" d="M8 5v14l11-7z" />,
  pause: (
    <path fill="currentColor" stroke="none" d="M7 5h3v14H7zM14 5h3v14h-3z" />
  ),
  'skip-forward': (
    <path fill="currentColor" stroke="none" d="M14 6h2v12h-2zM4 6v12l9-6z" />
  ),
  edit: <path d="M4 20h4L20 8l-4-4L4 16v4zM14 6l4 4" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  loop: (
    <path d="M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3" />
  )
}

interface IconProps {
  readonly name: IconName
  readonly className?: string
}

/**
 * Dumb inline SVG icon. It is decorative by contract (`aria-hidden`): the host
 * button carries the accessible label, so the icon never competes for the name.
 * Sized in `em` so it scales with the button's font-size.
 */
export function Icon({ name, className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {glyphs[name]}
    </svg>
  )
}
