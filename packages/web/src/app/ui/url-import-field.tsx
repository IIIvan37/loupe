import { isSupportedSourceUrl } from '@app/core'
import { Trans, useLingui } from '@lingui/react/macro'
import { type Ref, type ReactNode, type SubmitEvent, useId } from 'react'
import { cx } from '../../lib/cx.ts'
import styles from './url-import-field.module.css'

interface UrlImportFieldProps {
  /** The current field text (controlled — the consumer owns the string so it
   * can seed it from a paste and reset it when its surface reopens). */
  readonly value: string
  readonly onValueChange: (value: string) => void
  /** Start the import with the trimmed, supported URL. */
  readonly onSubmit: (url: string) => void
  /** A download is already running — the field and submit lock. */
  readonly busy: boolean
  /** Rendered left of the submit button (e.g. a popover Cancel). */
  readonly secondaryAction?: ReactNode
  /** Focus target for a seed-then-focus paste flow. */
  readonly inputRef?: Ref<HTMLInputElement>
}

/**
 * The shared media-URL entry, reused by the header import menu and the
 * empty-state hero. It owns the one invariant that must never drift between the
 * two: the field is validated against the SAME application policy the use-case
 * rejects on (`isSupportedSourceUrl`), so a doomed request can never leave and
 * both surfaces warn identically. Layout/state stay with the consumer.
 */
export function UrlImportField({
  value,
  onValueChange,
  onSubmit,
  busy,
  secondaryAction,
  inputRef
}: UrlImportFieldProps) {
  const { t } = useLingui()
  const warningId = useId()

  const trimmed = value.trim()
  const unsupported = trimmed !== '' && !isSupportedSourceUrl(trimmed)
  const canSubmit = trimmed !== '' && !busy && !unsupported

  function submit(event: SubmitEvent<HTMLFormElement>): void {
    event.preventDefault()
    if (canSubmit) {
      onSubmit(trimmed)
    }
  }

  return (
    <form className={cx(styles.form)} onSubmit={submit}>
      <p className={cx(styles.hint)}>
        <Trans id="import.url-hint">YouTube · SoundCloud</Trans>
      </p>
      <input
        ref={inputRef}
        className={cx(styles.input)}
        type="url"
        inputMode="url"
        placeholder="https://…"
        aria-label={t({ id: 'import.url-field', message: 'Lien du morceau' })}
        aria-invalid={unsupported || undefined}
        aria-describedby={unsupported ? warningId : undefined}
        disabled={busy}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
      />
      {unsupported && (
        <p id={warningId} className={cx(styles.warning)} role="alert">
          <Trans id="import.url-unsupported">
            Hôte non supporté — YouTube ou SoundCloud uniquement
          </Trans>
        </p>
      )}
      <div className={cx(styles.actions)}>
        {secondaryAction}
        <button
          type="submit"
          className={cx(styles.submit)}
          disabled={!canSubmit}
        >
          <Trans id="import.url-submit">Importer le lien</Trans>
        </button>
      </div>
    </form>
  )
}
