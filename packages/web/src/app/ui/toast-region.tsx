import { Toast } from '@base-ui-components/react/toast'
import { useLingui } from '@lingui/react/macro'
import { cx } from '../../lib/cx.ts'
import { Icon } from './icon.tsx'
import styles from './toast-region.module.css'
import type { Toaster } from './use-toaster.ts'

/** Maps the manager's live toasts to cards — must render under the Provider. */
function ToastList() {
  const { toasts } = Toast.useToastManager()
  const { t } = useLingui()
  return toasts.map((toast) => (
    <Toast.Root key={toast.id} toast={toast} className={cx(styles.toast)}>
      <Icon name="check" className={cx(styles.icon)} />
      <Toast.Title className={cx(styles.title)} />
      <Toast.Close
        className={cx(styles.close)}
        aria-label={t({ id: 'toast.dismiss', message: 'Fermer' })}
      >
        <Icon name="close" />
      </Toast.Close>
    </Toast.Root>
  ))
}

/**
 * The success-toast surface: a fixed viewport of transient confirmations fed by
 * the shell's `toaster`. Errors keep using `AlertBanner` (persistent, must-see);
 * toasts are the quiet "it worked" channel — export done, project saved.
 */
export function ToastRegion({ toaster }: { readonly toaster: Toaster }) {
  const { t } = useLingui()
  return (
    <Toast.Provider toastManager={toaster}>
      <Toast.Portal>
        <Toast.Viewport
          className={cx(styles.viewport)}
          aria-label={t({ id: 'toast.region', message: 'Notifications' })}
        >
          <ToastList />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  )
}
