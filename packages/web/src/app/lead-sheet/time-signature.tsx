import { cx } from '../../lib/cx.ts'
import styles from './lead-sheet.module.css'

/**
 * A time signature as stave notation: the numerator stacked over the
 * denominator (the mockup's `4` over `4`), never the inline "4/4" text.
 * Exposed as one image named by the plain signature so a screen reader says
 * « 4/4 », not « 4 4 ». A value that is not `N/M` (a free-form `{time:}`
 * directive) prints verbatim — showing what the user wrote beats hiding it.
 */
export function TimeSignature({
  signature,
  className
}: {
  /** The plain notation, e.g. `4/4`. */
  readonly signature: string
  readonly className?: string | undefined
}) {
  const parts = signature.split('/')
  const stacked =
    parts.length === 2 && parts.every((part) => part.trim() !== '')
  return (
    <span
      className={cx(styles.timeSignature, className)}
      role="img"
      aria-label={signature}
    >
      {stacked ? (
        <>
          <span aria-hidden>{parts[0]}</span>
          <span aria-hidden>{parts[1]}</span>
        </>
      ) : (
        <span aria-hidden>{signature}</span>
      )}
    </span>
  )
}
