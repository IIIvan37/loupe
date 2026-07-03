import type { Project } from '@app/core'
import { AppDialog } from '../app/ui/app-dialog.tsx'
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
      {armed ? 'Confirmer ?' : idle.label}
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
  onDelete,
  errorMessage,
  openingId,
  confirmBeforeOpen
}: ProjectsDialogProps) {
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
    return openingId === project.id ? 'Ouverture…' : 'Ouvrir'
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
      title="Projets"
      description="Reprends un projet enregistré là où tu l'as laissé."
    >
      {errorMessage !== undefined ? (
        <p className={cx(styles.error)} role="alert">
          {errorMessage}
        </p>
      ) : projects.length === 0 ? (
        <p className={cx(styles.empty)}>Aucun projet enregistré</p>
      ) : (
        <ul className={cx(styles.list)}>
          {projects.map((project) => {
            const armedAction =
              confirm?.id === project.id ? confirm.action : null
            return (
              <li key={project.id} className={cx(styles.row)}>
                <span className={cx(styles.name)}>{project.name}</span>
                <span className={cx(styles.updated)}>
                  {formatUpdatedAt(project.updatedAt)}
                </span>
                {armedAction === 'open' && (
                  <span className={cx(styles.confirmNote)}>
                    La session actuelle sera remplacée
                  </span>
                )}
                <RowAction
                  armed={armedAction === 'open'}
                  disabled={locked}
                  idle={{
                    label: openLabel(project),
                    className: styles.open,
                    onClick: () => onOpenClick(project.id)
                  }}
                  confirmAriaLabel={`Confirmer l'ouverture de ${project.name}`}
                  onConfirm={() => onOpen(project.id)}
                  onDisarm={disarm}
                />
                <RowAction
                  armed={armedAction === 'delete'}
                  disabled={locked}
                  idle={{
                    label: 'Supprimer',
                    ariaLabel: `Supprimer ${project.name}`,
                    className: styles.delete,
                    onClick: () => arm(project.id, 'delete')
                  }}
                  confirmAriaLabel={`Confirmer la suppression de ${project.name}`}
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
