import { Trans, useLingui } from '@lingui/react/macro'
import type { Project } from '@app/core'
import { AppDialog } from '../app/ui/app-dialog.tsx'
import { NameEditor } from '../app/ui/name-editor.tsx'
import { useTwoStepConfirm } from '../app/ui/use-two-step-confirm.ts'
import { cx } from '../lib/cx.ts'
import styles from './projects-dialog.module.css'

/** The row action awaiting its second, confirming click. */
interface PendingConfirm {
  readonly id: string
  readonly action: 'open' | 'delete'
}

interface ProjectsDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly projects: readonly Project[]
  /** Open the picked project. The smart shell rebuilds the session. */
  readonly onOpen: (id: string) => void
  /** Rename the picked project in place (trimmed, non-empty). */
  readonly onRename: (id: string, name: string) => void
  readonly onDelete: (id: string) => void
  /** Shown instead of the listing when the last refresh failed. */
  readonly errorMessage?: string | undefined
  /** The project currently being opened — rows lock while it loads. */
  readonly openingId?: string | undefined
  /** Ask before opening: a live session would be replaced. */
  readonly confirmBeforeOpen?: boolean | undefined
}

/** `12/05/2026` — the last-touch date, in the local convention. */
function formatUpdatedAt(updatedAt: number): string {
  return new Date(updatedAt).toLocaleDateString('fr-FR')
}

interface RowActionProps {
  readonly armed: boolean
  readonly disabled: boolean
  readonly idle: {
    readonly label: string
    readonly ariaLabel?: string
    readonly className: string | undefined
    readonly onClick: () => void
  }
  readonly confirmAriaLabel: string
  /** The confirmed action; RowAction disarms before running it. */
  readonly onConfirm: () => void
  readonly onDisarm: () => void
}

/**
 * A row action with its two-step confirmation, as ONE button element for both
 * faces. Swapping elements would unmount the button the user just focused —
 * focus falls to the body and the dialog's trap re-grabs it elsewhere;
 * relabeling in place keeps focus (and the screen-reader announcement) on the
 * action being confirmed.
 */
function RowAction({
  armed,
  disabled,
  idle,
  confirmAriaLabel,
  onConfirm,
  onDisarm
}: RowActionProps) {
  function confirm(): void {
    onDisarm()
    onConfirm()
  }

  return (
    <button
      type="button"
      className={cx(armed ? styles.confirmAction : idle.className)}
      aria-label={armed ? confirmAriaLabel : idle.ariaLabel}
      disabled={disabled}
      onBlur={armed ? onDisarm : undefined}
      onClick={armed ? confirm : idle.onClick}
    >
      {armed ? <Trans id="common.confirm">Confirmer ?</Trans> : idle.label}
    </button>
  )
}

/**
 * Dumb dialog listing the saved projects: open one, or delete one. The listing
 * and both actions live upstream — this only renders what it is given, plus
 * the ephemeral two-step confirmation (arm → « Confirmer ? », auto-revert).
 */
export function ProjectsDialog({
  open,
  onOpenChange,
  projects,
  onOpen,
  onRename,
  onDelete,
  errorMessage,
  openingId,
  confirmBeforeOpen
}: ProjectsDialogProps) {
  const { t } = useLingui()
  const { pending: confirm, arm: armPending, disarm } = useTwoStepConfirm<
    PendingConfirm
  >()

  function arm(id: string, action: PendingConfirm['action']): void {
    armPending({ id, action })
  }

  // A closed dialog forgets any armed confirmation — adjusted during render so
  // a reopen never flashes a stale « Confirmer ? » (no effect round-trip).
  if (!open && confirm !== null) {
    disarm()
  }

  const locked = openingId !== undefined

  function openLabel(project: Project): string {
    return openingId === project.id
      ? t({ id: 'projects.opening-row', message: 'Ouverture…' })
      : t({ id: 'projects.open', message: 'Ouvrir' })
  }

  function onOpenClick(id: string): void {
    if (confirmBeforeOpen) {
      arm(id, 'open')
      return
    }
    onOpen(id)
  }

  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t({ id: 'projects.title', message: 'Projets' })}
      description={t({
        id: 'projects.description',
        message: 'Reprendre un projet enregistré là où il a été laissé.'
      })}
    >
      {errorMessage !== undefined ? (
        <p className={cx(styles.error)} role="alert">
          {errorMessage}
        </p>
      ) : projects.length === 0 ? (
        <p className={cx(styles.empty)}>
          <Trans id="projects.empty">Aucun projet enregistré</Trans>
        </p>
      ) : (
        <ul className={cx(styles.list)}>
          {projects.map((project) => {
            const armedAction =
              confirm?.id === project.id ? confirm.action : null
            const name = project.name
            return (
              <li key={project.id} className={cx(styles.row)}>
                <span className={cx(styles.name)}>{project.name}</span>
                <span className={cx(styles.updated)}>
                  {formatUpdatedAt(project.updatedAt)}
                </span>
                {armedAction === 'open' && (
                  <span className={cx(styles.confirmNote)}>
                    <Trans id="session.replaced">
                      La session actuelle sera remplacée
                    </Trans>
                  </span>
                )}
                <NameEditor
                  title={t({
                    id: 'projects.rename-title',
                    message: 'Renommer le projet'
                  })}
                  triggerClassName={cx(styles.rename)}
                  triggerLabel={t({
                    id: 'projects.rename-named',
                    message: `Renommer ${name}`
                  })}
                  triggerContent={
                    <Trans id="projects.rename">Renommer</Trans>
                  }
                  submitLabel={t({
                    id: 'common.rename',
                    message: 'Renommer'
                  })}
                  initialName={project.name}
                  onSubmit={(next) => onRename(project.id, next)}
                />
                <RowAction
                  armed={armedAction === 'open'}
                  disabled={locked}
                  idle={{
                    label: openLabel(project),
                    className: styles.open,
                    onClick: () => onOpenClick(project.id)
                  }}
                  confirmAriaLabel={t({
                    id: 'projects.confirm-open',
                    message: `Confirmer l'ouverture de ${name}`
                  })}
                  onConfirm={() => onOpen(project.id)}
                  onDisarm={disarm}
                />
                <RowAction
                  armed={armedAction === 'delete'}
                  disabled={locked}
                  idle={{
                    label: t({ id: 'common.delete', message: 'Supprimer' }),
                    ariaLabel: t({
                      id: 'projects.delete-named',
                      message: `Supprimer ${name}`
                    }),
                    className: styles.delete,
                    onClick: () => arm(project.id, 'delete')
                  }}
                  confirmAriaLabel={t({
                    id: 'projects.confirm-delete',
                    message: `Confirmer la suppression de ${name}`
                  })}
                  onConfirm={() => onDelete(project.id)}
                  onDisarm={disarm}
                />
              </li>
            )
          })}
        </ul>
      )}
    </AppDialog>
  )
}
