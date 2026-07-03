import { useLingui } from '@lingui/react/macro'
import { cx } from '../../lib/cx.ts'
import styles from './alert-banner.module.css'

interface AlertBannerProps {
  readonly message: string
  readonly onDismiss: () => void
}

/**
 * Dumb dismissible alert strip for failures the user must see (a save or an
 * open that did not happen). The shell owns the message and the dismissal.
 */
export function AlertBanner({ message, onDismiss }: AlertBannerProps) {
  const { t } = useLingui()
  return (
    <div className={cx(styles.banner)} role="alert">
      <span className={cx(styles.message)}>{message}</span>
      <button
        type="button"
        className={cx(styles.close)}
        aria-label={t({ id: 'alerts.close', message: "Fermer l'alerte" })}
        onClick={onDismiss}
      >
        ✕
      </button>
    </div>
  )
}
