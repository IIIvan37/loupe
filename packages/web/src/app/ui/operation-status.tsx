import { Trans } from '@lingui/react/macro'
import { useEffect, useState } from 'react'
import styles from './operation-status.module.css'

interface OperationStatusProps {
  /** What is running (« Détection de la structure… »), resolved copy. */
  readonly label: string
  /** Real progress in [0, 1] when the flow streams one; absent = a live
   * indeterminate bar (the operation is running, its length unknown). */
  readonly progress?: number | undefined
  /** A second line for a wait that needs explaining (a cold start). */
  readonly detail?: string | undefined
  /** Hold the detail back until the wait grows suspicious (ms). */
  readonly detailAfterMs?: number | undefined
  /** Renders « Annuler » only when the flow can actually abort. */
  readonly onCancel?: (() => void) | undefined
}

/**
 * The one face of a long operation (R.1): a compact in-situ line — progress
 * bar (real or indeterminate), label, optional deferred explanation, optional
 * cancel. Every flow that used to swap a button label wears this instead;
 * the announcement channel stays with the owner (DetectionAction/LiveStatus).
 */
export function OperationStatus({
  label,
  progress,
  detail,
  detailAfterMs,
  onCancel
}: OperationStatusProps) {
  const percent =
    progress === undefined ? undefined : Math.round(progress * 100)
  // The detail waits: a fast run should come and go without the explanation
  // for a slow one ever flashing.
  const [detailDue, setDetailDue] = useState(
    detailAfterMs === undefined || detailAfterMs <= 0
  )
  useEffect(() => {
    if (detailAfterMs === undefined || detailAfterMs <= 0) {
      setDetailDue(true)
      return
    }
    // Re-armed (not just cleared) when the delay changes: the deferral must
    // hold even if a caller keeps the component mounted across two runs.
    setDetailDue(false)
    const timer = setTimeout(() => setDetailDue(true), detailAfterMs)
    return () => clearTimeout(timer)
  }, [detailAfterMs])

  return (
    <div className={styles.status}>
      <div className={styles.head}>
        <span>{label}</span>
        {percent !== undefined && (
          <span className={styles.percent}>{percent}%</span>
        )}
      </div>
      {/* No value attribute = the native indeterminate animation. */}
      {percent === undefined ? (
        <progress className={styles.bar} max={100} />
      ) : (
        <progress className={styles.bar} value={percent} max={100}>
          {percent}%
        </progress>
      )}
      {detail !== undefined && detailDue && (
        <p className={styles.detail}>{detail}</p>
      )}
      {onCancel !== undefined && (
        <button type="button" className={styles.cancel} onClick={onCancel}>
          <Trans id="common.cancel">Annuler</Trans>
        </button>
      )}
    </div>
  )
}
