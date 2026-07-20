import { Popover } from '@base-ui-components/react/popover'
import { Trans, useLingui } from '@lingui/react/macro'
import { useRef, useState } from 'react'
import { cx } from '../../lib/cx.ts'
import { UrlImportField } from '../ui/url-import-field.tsx'
import { useTwoStepConfirm } from '../ui/use-two-step-confirm.ts'
import headerStyles from './header.module.css'
import styles from './import-menu.module.css'

interface ImportMenuProps {
  /** Open the file picker (the shell owns the hidden input). */
  readonly onImportFile: () => void
  /** Start a URL download (YouTube / SoundCloud). Absent in the browser —
   * URL import is desktop-only (needs yt-dlp), so the entry hides. */
  readonly onImportUrl?: ((url: string) => void) | undefined
  /** A download is already running — the URL submit locks. */
  readonly urlBusy: boolean
  /** Ask before importing: the session holds work a new track would discard. */
  readonly needsConfirm: boolean
}

/**
 * The single import entry point as a menu: « Fichier… » (the picker) and
 * « Depuis une URL… » (a popover taking a media link). The unsaved-work guard
 * sits on opening the menu — while the session holds work, the first click arms
 * a « Confirmer ? » on the trigger and only the second opens the menu, so one
 * confirmation covers whichever path the user then picks. Built on Base UI
 * Popover (not Menu) so the whole surface stays reliably driveable.
 */
export function ImportMenu({
  onImportFile,
  onImportUrl,
  urlBusy,
  needsConfirm
}: ImportMenuProps) {
  const { t } = useLingui()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [urlOpen, setUrlOpen] = useState(false)
  const [url, setUrl] = useState('')
  const confirm = useTwoStepConfirm<true>()
  const armed = confirm.pending !== null

  // The session settled while armed (e.g. a save landed) — drop the warning
  // during render, no effect round-trip.
  if (armed && !needsConfirm) {
    confirm.disarm()
  }

  function onMenuOpenChange(next: boolean): void {
    if (next && needsConfirm && !armed) {
      // First activation while there's unsaved work only arms the confirmation;
      // the menu opens on the confirming second activation.
      confirm.arm(true)
      return
    }
    if (next) {
      confirm.disarm()
    }
    setMenuOpen(next)
  }

  function chooseFile(): void {
    setMenuOpen(false)
    onImportFile()
  }

  function chooseUrl(): void {
    setMenuOpen(false)
    setUrl('')
    setUrlOpen(true)
  }

  function submitUrl(link: string): void {
    onImportUrl?.(link)
    setUrlOpen(false)
  }

  return (
    <>
      <Popover.Root open={menuOpen} onOpenChange={onMenuOpenChange}>
        <Popover.Trigger
          ref={triggerRef}
          className={cx(
            armed ? headerStyles.confirmAction : headerStyles.primaryAction
          )}
          data-on-amber={armed ? undefined : ''}
          aria-label={
            armed
              ? t({
                  id: 'header.import-confirm',
                  message: "Confirmer l'import — la session actuelle sera remplacée"
                })
              : undefined
          }
          title={
            armed
              ? t({
                  id: 'session.replaced',
                  message: 'La session actuelle sera remplacée'
                })
              : undefined
          }
          onBlur={armed ? confirm.disarm : undefined}
        >
          {armed
            ? t({ id: 'common.confirm', message: 'Confirmer ?' })
            : t({ id: 'header.import', message: 'Importer' })}
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner className={cx(styles.positioner)} sideOffset={6}>
            <Popover.Popup className={cx(styles.menu)}>
              <button
                type="button"
                className={cx(styles.item)}
                onClick={chooseFile}
              >
                <Trans id="header.import-from-file">Fichier…</Trans>
              </button>
              {onImportUrl && (
                <button
                  type="button"
                  className={cx(styles.item)}
                  onClick={chooseUrl}
                >
                  <Trans id="header.import-from-url">Depuis une URL…</Trans>
                </button>
              )}
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>

      {onImportUrl && (
        <Popover.Root open={urlOpen} onOpenChange={setUrlOpen}>
        <Popover.Portal>
          <Popover.Positioner
            className={cx(styles.positioner)}
            anchor={triggerRef}
            sideOffset={6}
          >
            <Popover.Popup className={cx(styles.popup)}>
              <Popover.Title className={cx(styles.title)}>
                <Trans id="header.import-url-title">Importer depuis une URL</Trans>
              </Popover.Title>
              <UrlImportField
                value={url}
                onValueChange={setUrl}
                onSubmit={submitUrl}
                busy={urlBusy}
                secondaryAction={
                  <Popover.Close className={cx(styles.ghost)}>
                    <Trans id="common.cancel">Annuler</Trans>
                  </Popover.Close>
                }
              />
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
        </Popover.Root>
      )}
    </>
  )
}
