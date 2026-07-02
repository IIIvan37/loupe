import type { Project } from '@app/core'
import { useEffect, useRef, useState } from 'react'
import { AppDialog } from '../app/ui/app-dialog.tsx'
import { cx } from '../lib/cx.ts'
import styles from './projects-dialog.module.css'

/** How long an armed « Confirmer ? » stays armed before reverting. */
const CONFIRM_REVERT_MS = 4000

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
  const [confirm, setConfirm] = useState<PendingConfirm | null>(null)
  const revertTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  )

  function disarm(): void {
    clearTimeout(revertTimer.current)
    setConfirm(null)
  }

  function arm(id: string, action: PendingConfirm['action']): void {
    clearTimeout(revertTimer.current)
    setConfirm({ id, action })
    revertTimer.current = setTimeout(() => setConfirm(null), CONFIRM_REVERT_MS)
  }

  // A closed dialog forgets any armed confirmation — adjusted during render so
  // a reopen never flashes a stale « Confirmer ? » (no effect round-trip).
  if (!open && confirm !== null) {
    setConfirm(null)
  }

  // Clear the revert timer on unmount so it never fires into a gone component.
  useEffect(() => () => clearTimeout(revertTimer.current), [])

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
          {projects.map((project) => (
            <li key={project.id} className={cx(styles.row)}>
              <span className={cx(styles.name)}>{project.name}</span>
              <span className={cx(styles.updated)}>
                {formatUpdatedAt(project.updatedAt)}
              </span>
              {confirm?.id === project.id && confirm.action === 'open' ? (
                <>
                  <span className={cx(styles.confirmNote)}>
                    La session actuelle sera remplacée
                  </span>
                  <button
                    type="button"
                    className={cx(styles.confirmAction)}
                    aria-label={`Confirmer l'ouverture de ${project.name}`}
                    disabled={locked}
                    onBlur={disarm}
                    onClick={() => {
                      disarm()
                      onOpen(project.id)
                    }}
                  >
                    Confirmer ?
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className={cx(styles.open)}
                  disabled={locked}
                  onClick={() => onOpenClick(project.id)}
                >
                  {openLabel(project)}
                </button>
              )}
              {confirm?.id === project.id && confirm.action === 'delete' ? (
                <button
                  type="button"
                  className={cx(styles.confirmAction)}
                  aria-label={`Confirmer la suppression de ${project.name}`}
                  disabled={locked}
                  onBlur={disarm}
                  onClick={() => {
                    disarm()
                    onDelete(project.id)
                  }}
                >
                  Confirmer ?
                </button>
              ) : (
                <button
                  type="button"
                  className={cx(styles.delete)}
                  aria-label={`Supprimer ${project.name}`}
                  disabled={locked}
                  onClick={() => arm(project.id, 'delete')}
                >
                  Supprimer
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </AppDialog>
  )
}
