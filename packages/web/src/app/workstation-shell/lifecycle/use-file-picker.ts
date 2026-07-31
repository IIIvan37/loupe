import { useLingui } from '@lingui/react/macro'
import { type RefObject, useRef } from 'react'

export interface FilePicker {
  /** The one hidden `<input type="file">` the shell renders. */
  readonly fileInputRef: RefObject<HTMLInputElement | null>
  /** Open the OS file dialog (the header's « Importer », the empty-state hero). */
  readonly openFilePicker: () => void
  /** The input's accessible label. */
  readonly importLabel: string
}

/**
 * The one hidden file input shared across the shell + its accessible label. A
 * drag never touches the input — it carries a File directly — so this owns only
 * the click-to-open path. Kept out of the top-level component as one call.
 */
export function useFilePicker(): FilePicker {
  const { t } = useLingui()
  const fileInputRef = useRef<HTMLInputElement>(null)
  return {
    fileInputRef,
    openFilePicker: () => fileInputRef.current?.click(),
    importLabel: t({
      id: 'header.import-file',
      message: 'Importer un fichier audio'
    })
  }
}
