import { type ReactNode, useId } from 'react'
import { Stack } from '../../layout/stack/stack.tsx'
import styles from './shell-section.module.css'

interface ShellSectionFold {
  readonly open: boolean
  readonly onToggle: () => void
  /** What the zone acquired — shown in the header while folded. */
  readonly summary?: string | undefined
}

interface ShellSectionProps {
  /** The zone's visible title, already resolved through Lingui. */
  readonly label: string
  /**
   * Makes the zone collapsible (Q.3): the title becomes the disclosure
   * button — the canonical accordion, `<h2><button aria-expanded>` — and the
   * folded header keeps the acquired-state summary in view.
   */
  readonly fold?: ShellSectionFold | undefined
  readonly children: ReactNode
}

/**
 * One named zone of the workstation column (Q.1): Timeline, Analyse,
 * Partition. The title speaks the shared section-label voice and names a real
 * region for assistive tech — the grouping is structure, not just spacing.
 */
export function ShellSection({ label, fold, children }: ShellSectionProps) {
  const headingId = useId()
  const contentId = useId()
  return (
    <section aria-labelledby={headingId}>
      <Stack gap="var(--space-xs)">
        {fold ? (
          <div className={styles.foldHeader}>
            <h2 id={headingId} className={styles.label}>
              <button
                type="button"
                className={styles.foldToggle}
                aria-expanded={fold.open}
                aria-controls={contentId}
                onClick={fold.onToggle}
              >
                {label}
              </button>
            </h2>
            {!fold.open && fold.summary !== undefined && (
              <span className={styles.summary}>{fold.summary}</span>
            )}
          </div>
        ) : (
          <h2 id={headingId} className={styles.label}>
            {label}
          </h2>
        )}
        {(fold === undefined || fold.open) && (
          <div id={contentId}>
            <Stack gap="var(--space-xs)">{children}</Stack>
          </div>
        )}
      </Stack>
    </section>
  )
}
