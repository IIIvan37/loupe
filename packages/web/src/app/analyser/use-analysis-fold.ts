import type { Project } from '@app/core'
import { useState } from 'react'

/**
 * Whether the Analyse zone is unfolded — a render preference of this browser
 * (localStorage), never project data. Only a MANUAL toggle is stored: the
 * defaults (fresh import opens, a fully-analysed reopened project folds into
 * practice mode) apply as long as the user hasn't chosen. Storage failures
 * (private mode, quota) silently fall back — a preference is never worth an
 * error.
 */
const KEY = 'loupe.analyser.open'

function readStoredOpen(): boolean | undefined {
  try {
    const raw = localStorage.getItem(KEY)
    return raw === null ? undefined : raw === 'true'
  } catch {
    return undefined
  }
}

function storeOpen(open: boolean): void {
  try {
    localStorage.setItem(KEY, String(open))
  } catch {
    // Private mode / quota: the session keeps its fold, it just won't stick.
  }
}

export interface AnalysisFold {
  readonly open: boolean
  /** The user's explicit choice — the only path that persists. */
  readonly toggle: () => void
  /** A fresh import is analysis time: open, unless a stored choice says no. */
  readonly seatForFreshImport: () => void
  /**
   * A reopened project that already holds its analyses (tempo + grid) lands
   * in practice mode — folded — unless a stored choice says otherwise.
   */
  readonly seatForRestoredProject: (project: Project) => void
}

/** The fold's own definition of « analysed »: a tempo and a chord grid. */
function isAnalysed(project: Project): boolean {
  return (
    project.tempo !== undefined &&
    (project.chordChart?.source.trim().length ?? 0) > 0
  )
}

export function useAnalysisFold(): AnalysisFold {
  const [open, setOpen] = useState(() => readStoredOpen() ?? true)

  function toggle(): void {
    setOpen((current) => {
      const next = !current
      storeOpen(next)
      return next
    })
  }

  function seatForFreshImport(): void {
    setOpen(readStoredOpen() ?? true)
  }

  function seatForRestoredProject(project: Project): void {
    setOpen(readStoredOpen() ?? !isAnalysed(project))
  }

  return { open, toggle, seatForFreshImport, seatForRestoredProject }
}
