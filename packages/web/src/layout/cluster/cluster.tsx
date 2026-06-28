import type { CSSProperties, ReactNode } from 'react'
import { cx } from '../../lib/cx.ts'
import styles from './cluster.module.css'

interface ClusterProps {
  readonly children: ReactNode
  /** Space between items (any CSS length). */
  readonly gap?: string
  readonly justify?: CSSProperties['justifyContent']
  readonly align?: CSSProperties['alignItems']
  readonly className?: string
}

/**
 * Every Layout — Cluster. Groups items horizontally with a consistent gap and
 * wraps gracefully. Used for toolbars, button rows and readout groups.
 */
export function Cluster({ children, gap, justify, align, className }: ClusterProps) {
  const style = {
    ...(gap ? { '--cluster-gap': gap } : {}),
    ...(justify ? { justifyContent: justify } : {}),
    ...(align ? { alignItems: align } : {})
  } as CSSProperties
  return (
    <div className={cx(styles.cluster, className)} style={style}>
      {children}
    </div>
  )
}
