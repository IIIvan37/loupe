import { Trans } from '@lingui/react/macro'
import { type KeyboardEvent, type ReactNode, useState } from 'react'
import { cx } from '../../lib/cx.ts'
import styles from './name-editor.module.css'
import { PopoverForm } from './popover-form.tsx'

interface NameEditorProps {
  readonly title: string
  /** Class + accessible label + content for the Popover trigger button. */
  readonly triggerClassName: string
  readonly triggerLabel: string
  readonly triggerContent: ReactNode
  readonly submitLabel: string
  readonly initialName: string
  readonly onSubmit: (name: string) => void
}

/**
 * Dumb Base UI Popover that renames a thing (a loop, a marker). A single name
 * field — start/end edits live on the waveform handles, not here. The trimmed
 * name is required; Enter submits.
 */
export function NameEditor({
  title,
  triggerClassName,
  triggerLabel,
  triggerContent,
  submitLabel,
  initialName,
  onSubmit
}: NameEditorProps) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(initialName)

  function onOpenChange(next: boolean): void {
    // Reseed on open so a cancelled edit is forgotten.
    if (next) {
      setName(initialName)
    }
    setOpen(next)
  }

  function submit(): void {
    const trimmed = name.trim()
    if (trimmed === '') {
      return
    }
    onSubmit(trimmed)
    setOpen(false)
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Enter') {
      event.preventDefault()
      submit()
    }
  }

  return (
    <PopoverForm
      open={open}
      onOpenChange={onOpenChange}
      triggerClassName={triggerClassName}
      triggerLabel={triggerLabel}
      triggerContent={triggerContent}
      title={title}
      popupClassName={cx(styles.popup)}
      submitLabel={submitLabel}
      submitDisabled={name.trim() === ''}
      onSubmit={submit}
    >
      <label className={cx(styles.field)}>
        <span className={cx(styles.label)}>
          <Trans id="common.name">Nom</Trans>
        </span>
        <input
          className={cx(styles.input)}
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={onKeyDown}
        />
      </label>
    </PopoverForm>
  )
}
