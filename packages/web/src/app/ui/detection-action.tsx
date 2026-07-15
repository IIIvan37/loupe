import { Stack } from '../../layout/stack/stack.tsx'
import { LiveStatus } from './live-status.tsx'
import { OperationStatus } from './operation-status.tsx'
import { useTwoStepConfirm } from './use-two-step-confirm.ts'
import styles from './detection-action.module.css'

/** What the running face shows beyond the bare indeterminate bar. */
export interface DetectionProgress {
  /** Real progress in [0, 1] when the flow streams one. */
  readonly value?: number | undefined
  /** A second line for a wait that needs explaining (a cold start). */
  readonly detail?: string | undefined
  /** Hold the detail back until the wait grows suspicious (ms). */
  readonly detailAfterMs?: number | undefined
  /** Offered as « Annuler » while the run is in flight. */
  readonly onCancel?: (() => void) | undefined
}

interface DetectionActionProps {
  /** The action's idle face (« Détecter la structure »), resolved copy. */
  readonly label: string
  /** The running face's label (defaults to the idle label). */
  readonly runningLabel?: string | undefined
  readonly running: boolean
  /** Progress/cancel details of the running face (indeterminate without). */
  readonly progress?: DetectionProgress | undefined
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
  progress,
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
      {/* The running face IS the operation line (R.1): a live bar instead of
          a swapped, disabled button label. */}
      {running ? (
        <OperationStatus
          label={runningLabel ?? label}
          progress={progress?.value}
          detail={progress?.detail}
          detailAfterMs={progress?.detailAfterMs}
          onCancel={progress?.onCancel}
        />
      ) : (
        <button
          type="button"
          className={styles.action}
          disabled={disabled}
          onClick={onClick}
          onBlur={overwrite.disarm}
        >
          {overwrite.pending ? (confirmLabel ?? label) : label}
        </button>
      )}
      {hint !== undefined && <p className={styles.hint}>{hint}</p>}
      {/* Failures interrupt (role="alert") — the shell-wide contract for a
          run that just died; the polite channel below narrates the rest. */}
      {errorLine !== undefined && (
        <p role="alert" className={styles.error}>
          {errorLine}
        </p>
      )}
      {/* Kept mounted EVEN when the owner never announces (an idle, empty
          polite region is inert for AT): a region mounted with its first
          message would never speak it — only changes after mount are read. */}
      <LiveStatus message={announcement} />
    </Stack>
  )
}
