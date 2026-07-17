import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react/macro'
import { i18n } from '../../i18n/i18n.ts'
import { AppDialog } from '../ui/app-dialog.tsx'
import styles from './format-help-dialog.module.css'

interface FormatHelpDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
}

/**
 * The grid grammar taught nowhere else — the P.2+ form vocabulary (repeats,
 * voltas, form marks, directives) only the placeholder's two lines hinted at.
 * Static rows: each shows a literal source snippet and what it means.
 */
const ROWS: ReadonlyArray<{
  readonly example: string
  readonly meaning: MessageDescriptor
}> = [
  {
    example: '[Couplet]',
    meaning: msg({ id: 'chords.help-section', message: 'Nommer une section' })
  },
  {
    example: '| C | Am7 | F | G |',
    meaning: msg({
      id: 'chords.help-measures',
      message: 'Une mesure entre deux barres'
    })
  },
  {
    example: '| C G |',
    meaning: msg({
      id: 'chords.help-split',
      message: 'Un accord par moitié de mesure'
    })
  },
  {
    example: '| N.C. |',
    meaning: msg({ id: 'chords.help-silence', message: 'Mesure sans accord' })
  },
  {
    example: '|: C | G :|',
    meaning: msg({ id: 'chords.help-repeat', message: 'Reprise' })
  },
  {
    example: '|: C | G :| x3',
    meaning: msg({
      id: 'chords.help-repeat-count',
      message: 'Reprise jouée N fois'
    })
  },
  {
    example: '|: C | 1. G :| 2. F |',
    meaning: msg({
      id: 'chords.help-voltas',
      message: 'Fins alternatives (voltas)'
    })
  },
  {
    example: 'C@',
    meaning: msg({ id: 'chords.help-fermata', message: "Point d'orgue" })
  },
  {
    example: '{d.c.} {coda} {fine}',
    meaning: msg({
      id: 'chords.help-form',
      message: 'Marques de forme (da capo, coda, fin)'
    })
  },
  {
    example: '{time: 3/4}',
    meaning: msg({
      id: 'chords.help-time',
      message: 'Signature rythmique (en tête ou en cours de grille)'
    })
  },
  {
    example: '{form: 3x}',
    meaning: msg({
      id: 'chords.help-rollout',
      message: 'Jouer toute la grille N fois'
    })
  },
  {
    example: '{title: …} {key: …} {tempo: …}',
    meaning: msg({
      id: 'chords.help-directives',
      message: "Surcharger l'en-tête du chart"
    })
  }
]

/** Dumb reference card for the grid source format, one row per construct. */
export function FormatHelpDialog({ open, onOpenChange }: FormatHelpDialogProps) {
  const { t } = useLingui()
  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t({ id: 'chords.format-help', message: 'Aide du format' })}
      description={t({
        id: 'chords.format-help-intro',
        message: 'La grille se tape en texte : une ligne par rangée de mesures.'
      })}
    >
      <dl className={styles.list}>
        {ROWS.map((row) => (
          <div key={row.example} className={styles.row}>
            <dt className={styles.example}>
              <code>{row.example}</code>
            </dt>
            <dd className={styles.meaning}>{i18n._(row.meaning)}</dd>
          </div>
        ))}
      </dl>
    </AppDialog>
  )
}
