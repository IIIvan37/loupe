import { parseFormRollout } from '@app/core'
import { useLingui } from '@lingui/react/macro'
import styles from './lead-sheet.module.css'

/**
 * What the session can derive for the chart head: the track tags, the detected
 * BPM and the beat grid's bar length. No key — the app detects none yet, so the
 * key line only exists through a `{key: …}` directive (never a hardcoded lie).
 */
export interface ChartHeaderData {
  readonly title?: string | undefined
  readonly artist?: string | undefined
  readonly bpm?: number | undefined
  readonly beatsPerBar?: number | undefined
}

interface ChartHeaderProps {
  readonly derived: ChartHeaderData
  /** The chart's own `{k: v}` head lines — they win over the session. */
  readonly directives: Readonly<Record<string, string>>
}

/** An empty directive (`{key:}`) overrides nothing — '' is no value. */
function over(value: string | undefined): string | undefined {
  return value ? value : undefined
}

/**
 * The printed lead-sheet head: `key of X` and `♩ = BPM` on the top line, then
 * title and artist, then the meta line (style). Derived from the session by
 * default, overridden field by field by the source's directives so the chart
 * stays self-supporting. `♩` is chart notation (document content like the
 * chord letters, no catalog entry); `key of` is prose, so it rides Lingui.
 * The time signature is NOT a head field: it prints as stave notation at the
 * head of the grid's first system (the mockup's stacked 4-over-4).
 */
export function ChartHeader({ derived, directives }: ChartHeaderProps) {
  const { t } = useLingui()
  const title = over(directives.title) ?? derived.title
  const artist = over(directives.artist) ?? derived.artist
  const key = over(directives.key)
  const tempo =
    over(directives.tempo) ??
    (derived.bpm === undefined ? undefined : String(Math.round(derived.bpm)))
  const style = over(directives.style)
  // The rollout line: a machine-readable {form: 3x} prints as prose ("jouer
  // 3 fois"); any other annotation ("3 chorus, head in/out") prints verbatim
  // — the déroulé stays one head note, never re-encoded into the grid.
  const count = parseFormRollout(directives.form)
  const form =
    count === undefined
      ? over(directives.form)
      : t({ id: 'chart.form-rollout', message: `Jouer ${count} fois` })

  const fields = [title, artist, key, tempo, style, form]
  if (fields.every((field) => field === undefined)) return null

  return (
    <header className={styles.chartHeader}>
      {(key !== undefined || tempo !== undefined) && (
        <p className={styles.chartTopLine}>
          {key !== undefined && (
            <span>{t({ id: 'chart.key-of', message: `key of ${key}` })}</span>
          )}
          {tempo !== undefined && (
            <span className={styles.chartTempo}>♩ = {tempo}</span>
          )}
        </p>
      )}
      {title !== undefined && <h3 className={styles.chartTitle}>{title}</h3>}
      {artist !== undefined && <p className={styles.chartArtist}>{artist}</p>}
      {(style !== undefined || form !== undefined) && (
        <p className={styles.chartMeta}>
          {style !== undefined && (
            <span className={styles.chartStyle}>{style}</span>
          )}
          {form !== undefined && (
            <span className={styles.chartForm}>{form}</span>
          )}
        </p>
      )}
    </header>
  )
}
