import { Stack } from '../../layout/stack/stack.tsx'
import { LiveStatus } from './live-status.tsx'
import { useTwoStepConfirm } from './use-two-step-confirm.ts'
import styles from './detection-action.module.css'

interface DetectionActionProps {
  /** The action's idle face (« Détecter la structure »), resolved copy. */
  readonly label: string
  /** Swapped in while the run is in flight. */
  readonly runningLabel: string
  readonly running: boolean
  /**
   * Whether a run would overwrite existing work: the first activation then
   * only arms a « Confirmer ? » beat wearing `confirmLabel`.
   */
  readonly confirms?: boolean | undefined
  readonly confirmLabel?: string | undefined
  /** One explaining line under the button: why blocked, or what to expect. */
  readonly hint?: string | undefined
  /** The failure line — shown here AND spoken via `announcement`. */
  readonly errorLine?: string | undefined
  /** The live-region channel (busy → done / failed), resolved by the owner. */
  readonly announcement?: string | undefined
  readonly disabled?: boolean | undefined
  readonly onRun: () => void
}

/**
 * The shared grammar of every analysis action (Q.2): one button that runs a
 * detection, confirms before overwriting armed work, explains why it is
 * blocked, states how the last run failed, and speaks its state to AT. The
 * four flows (separation, tempo, structure, chords) each used to hand-roll
 * this quartet.
 */
export function DetectionAction({
  label,
  runningLabel,
  running,
  confirms = false,
  confirmLabel,
  hint,
  errorLine,
  announcement,
  disabled = false,
  onRun
}: DetectionActionProps) {
  const overwrite = useTwoStepConfirm<true>()

  function onClick(): void {
    if (confirms && overwrite.pending === null) {
      overwrite.arm(true)
      return
    }
    overwrite.disarm()
    onRun()
  }

  return (
    <Stack gap="var(--space-2xs)">
      <button
        type="button"
        className={styles.action}
        disabled={disabled || running}
        onClick={onClick}
        onBlur={overwrite.disarm}
      >
        {running
          ? runningLabel
          : overwrite.pending
            ? (confirmLabel ?? label)
            : label}
      </button>
      {hint !== undefined && <p className={styles.hint}>{hint}</p>}
      {/* Failures interrupt (role="alert") — the shell-wide contract for a
          run that just died; the polite channel below narrates the rest. */}
      {errorLine !== undefined && (
        <p role="alert" className={styles.error}>
          {errorLine}
        </p>
      )}
      {/* Kept mounted so a state change (busy → done) is spoken. */}
      <LiveStatus message={announcement} />
    </Stack>
  )
}
