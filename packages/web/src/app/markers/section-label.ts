import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'

/**
 * The structure engine's raw section vocabulary (SongFormer: `intro`, `verse`,
 * `chorus`, `bridge`, `inst`, `outro`, `silence`, `pre-chorus`) mapped to the
 * display copy a section marker shows. Translating the engine's labels is the
 * UI's job — the adapter and core keep them raw. An unknown tag has no entry:
 * the caller falls back to the raw label so a new engine vocabulary still lands
 * a usable marker instead of dropping it.
 */
const SECTION_LABELS: Readonly<Record<string, MessageDescriptor>> = {
  intro: msg({ id: 'structure.section.intro', message: 'Intro' }),
  verse: msg({ id: 'structure.section.verse', message: 'Couplet' }),
  'pre-chorus': msg({
    id: 'structure.section.pre-chorus',
    message: 'Pré-refrain'
  }),
  chorus: msg({ id: 'structure.section.chorus', message: 'Refrain' }),
  bridge: msg({ id: 'structure.section.bridge', message: 'Pont' }),
  inst: msg({ id: 'structure.section.inst', message: 'Instrumental' }),
  outro: msg({ id: 'structure.section.outro', message: 'Outro' }),
  silence: msg({ id: 'structure.section.silence', message: 'Silence' })
}

/** The display copy descriptor for a raw section label, or undefined if unknown. */
export function sectionLabelDescriptor(
  raw: string
): MessageDescriptor | undefined {
  return SECTION_LABELS[raw]
}
