import { defaultKeyBindings } from '@app/core'
import { useLingui } from '@lingui/react/macro'
import { ProjectsDialog } from '../../projects/projects-dialog.tsx'
import { describeKeyBindings } from '../keyboard/shortcut-hints.ts'
import { ShortcutsDialog } from '../keyboard/shortcuts-dialog.tsx'
import type { ProjectSession } from './use-project-session.ts'

/** Help rows derived once from the shipped layout — never drift from the keys. */
const SHORTCUT_HINTS = describeKeyBindings(defaultKeyBindings)

interface ShellDialogsProps {
  readonly shortcutsOpen: boolean
  readonly onShortcutsOpenChange: (open: boolean) => void
  readonly projectsOpen: boolean
  readonly onProjectsOpenChange: (open: boolean) => void
  readonly session: ProjectSession
}

/** The shell's two overlays: keyboard-shortcuts help and saved projects. */
export function ShellDialogs({
  shortcutsOpen,
  onShortcutsOpenChange,
  projectsOpen,
  onProjectsOpenChange,
  session
}: ShellDialogsProps) {
  const { t } = useLingui()
  const projects = session.projects

  return (
    <>
      <ShortcutsDialog
        open={shortcutsOpen}
        onOpenChange={onShortcutsOpenChange}
        hints={SHORTCUT_HINTS}
      />
      <ProjectsDialog
        open={projectsOpen}
        onOpenChange={onProjectsOpenChange}
        projects={projects.projects}
        onOpen={(id) => void session.handleOpen(id)}
        onRename={(id, name) => void projects.rename(id, name)}
        onDelete={(id) => void projects.remove(id)}
        errorMessage={
          projects.listError
            ? t({
                id: 'projects.unreachable',
                message: 'Impossible de lister les projets — réessayer.'
              })
            : undefined
        }
        openingId={session.openingId}
        confirmBeforeOpen={session.unsavedWork}
      />
    </>
  )
}
