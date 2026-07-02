import type { Project } from '@app/core'
import { AppDialog } from '../app/ui/app-dialog.tsx'
import { cx } from '../lib/cx.ts'
import styles from './projects-dialog.module.css'

interface ProjectsDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly projects: readonly Project[]
  /** Open the picked project. The smart shell rebuilds the session. */
  readonly onOpen: (id: string) => void
  readonly onDelete: (id: string) => void
}

/** `12/05/2026` — the last-touch date, in the local convention. */
function formatUpdatedAt(updatedAt: number): string {
  return new Date(updatedAt).toLocaleDateString('fr-FR')
}

/**
 * Dumb dialog listing the saved projects: open one, or delete one. The listing
 * and both actions live upstream — this only renders what it is given.
 */
export function ProjectsDialog({
  open,
  onOpenChange,
  projects,
  onOpen,
  onDelete
}: ProjectsDialogProps) {
  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Projets"
      description="Reprends un projet enregistré là où tu l'as laissé."
    >
      {projects.length === 0 ? (
        <p className={cx(styles.empty)}>Aucun projet enregistré</p>
      ) : (
        <ul className={cx(styles.list)}>
          {projects.map((project) => (
            <li key={project.id} className={cx(styles.row)}>
              <span className={cx(styles.name)}>{project.name}</span>
              <span className={cx(styles.updated)}>
                {formatUpdatedAt(project.updatedAt)}
              </span>
              <button
                type="button"
                className={cx(styles.open)}
                onClick={() => onOpen(project.id)}
              >
                Ouvrir
              </button>
              <button
                type="button"
                className={cx(styles.delete)}
                aria-label={`Supprimer ${project.name}`}
                onClick={() => onDelete(project.id)}
              >
                Supprimer
              </button>
            </li>
          ))}
        </ul>
      )}
    </AppDialog>
  )
}
