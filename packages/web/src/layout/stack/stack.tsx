import type { CSSProperties, ReactNode } from 'react'
import { cx } from '../../lib/cx.ts'
import styles from './stack.module.css'

interface StackProps {
  readonly children: ReactNode
  /** Vertical rhythm between children (any CSS length). */
  readonly gap?: string
  readonly className?: string
}

/**
 * Every Layout — Stack. Owns the vertical space between its children via the
 * owl selector; children stay agnostic of their surroundings.
 */
export function Stack({ children, gap, className }: StackProps) {
  const style = gap ? ({ '--stack-gap': gap } as CSSProperties) : undefined
  return (
    <div className={cx(styles.stack, className)} style={style}>
      {children}
    </div>
  )
}
