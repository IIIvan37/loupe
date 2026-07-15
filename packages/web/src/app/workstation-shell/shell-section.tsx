import { type ReactNode, useId } from 'react'
import { Stack } from '../../layout/stack/stack.tsx'
import styles from './shell-section.module.css'

interface ShellSectionProps {
  /** The zone's visible title, already resolved through Lingui. */
  readonly label: string
  readonly children: ReactNode
}

/**
 * One named zone of the workstation column (Q.1): Timeline, Analyse,
 * Partition. The title speaks the shared section-label voice and names a real
 * region for assistive tech — the grouping is structure, not just spacing.
 */
export function ShellSection({ label, children }: ShellSectionProps) {
  const headingId = useId()
  return (
    <section aria-labelledby={headingId}>
      <Stack gap="var(--space-xs)">
        <h2 id={headingId} className={styles.label}>
          {label}
        </h2>
        {children}
      </Stack>
    </section>
  )
}
