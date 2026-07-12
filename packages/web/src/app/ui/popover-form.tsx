import { Popover } from '@base-ui-components/react/popover'
import { Trans } from '@lingui/react/macro'
import type { ReactNode } from 'react'
import { cx } from '../../lib/cx.ts'
import styles from './popover-form.module.css'

interface PopoverFormProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  /** Class + optional accessible label + content for the trigger button. */
  readonly triggerClassName: string
  readonly triggerLabel?: string | undefined
  readonly triggerContent: ReactNode
  readonly title: ReactNode
  /** Consumer skin for the popup (typically just its width). */
  readonly popupClassName?: string
  readonly submitLabel: ReactNode
  readonly submitDisabled?: boolean
  readonly onSubmit: () => void
  /** The form's fields. */
  readonly children: ReactNode
}

/**
 * Dumb skeleton of the small popover forms (rename, tempo ramp): trigger,
 * portal/positioner/popup shell, title, the consumer's fields, and the shared
 * « Annuler » / submit action row. The consumer owns the open state (so it can
 * reseed its fields on open) and the submit semantics; field markup composes
 * the same `popover-form.module.css` skin this shell uses.
 */
export function PopoverForm({
  open,
  onOpenChange,
  triggerClassName,
  triggerLabel,
  triggerContent,
  title,
  popupClassName,
  submitLabel,
  submitDisabled = false,
  onSubmit,
  children
}: PopoverFormProps) {
  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger
        className={cx(triggerClassName)}
        aria-label={triggerLabel}
      >
        {triggerContent}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner className={cx(styles.positioner)} sideOffset={6}>
          <Popover.Popup className={cx(styles.popup, popupClassName)}>
            <Popover.Title className={cx(styles.title)}>{title}</Popover.Title>
            {children}
            <div className={cx(styles.actions)}>
              <Popover.Close className={cx(styles.ghost)}>
                <Trans id="common.cancel">Annuler</Trans>
              </Popover.Close>
              <button
                type="button"
                className={cx(styles.submit)}
                disabled={submitDisabled}
                onClick={onSubmit}
              >
                {submitLabel}
              </button>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
