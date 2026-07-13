import { useLingui } from '@lingui/react/macro'
import { useRef, useState } from 'react'
import {
  isValidBarsPerRow,
  MAX_BARS_PER_ROW,
  MIN_BARS_PER_ROW,
  storeBarsPerRow
} from './bars-per-row-preference.ts'
import styles from './chord-chart-panel.module.css'

interface BarsPerRowFieldProps {
  /** The layout currently applied to the sheet. */
  readonly value: number
  /** Fires with every valid layout — live preview while typing, the settled
   * choice (or the revert to it) on blur. */
  readonly onChange: (bars: number) => void
}

/**
 * The « mes. / ligne » field: a live preview that only SETTLES (and persists
 * to localStorage) on blur, so a rejected or abandoned edit never sticks.
 * Owns the whole draft lifecycle; the parent just holds the applied value.
 */
export function BarsPerRowField({ value, onChange }: BarsPerRowFieldProps) {
  const { t } = useLingui()
  // The last deliberate choice — what an abandoned or rejected edit settles
  // back to on blur, so a mid-edit preview never clobbers the preference.
  const settledBars = useRef(value)
  // What the field shows while being edited — an emptied or out-of-range
  // draft is no layout, so the sheet keeps the last committed value.
  const [barsDraft, setBarsDraft] = useState<string | undefined>(undefined)
  // Browsers surface unparseable number-input content as '' + validity
  // .badInput — without this flag that garbage would pass as « transient ».
  const [barsBadInput, setBarsBadInput] = useState(false)
  // An empty draft is a transient mid-edit state; only content that cannot
  // become a layout gets flagged (the old behaviour rejected silently).
  const barsDraftInvalid =
    barsBadInput ||
    (barsDraft !== undefined &&
      barsDraft !== '' &&
      !isValidBarsPerRow(Number(barsDraft)))
  return (
    <span className={styles.layout}>
      <input
        type="number"
        className={styles.barsField}
        inputMode="numeric"
        min={MIN_BARS_PER_ROW}
        max={MAX_BARS_PER_ROW}
        value={barsDraft ?? value}
        onChange={(event) => {
          setBarsDraft(event.target.value)
          setBarsBadInput(event.target.validity?.badInput ?? false)
          const bars = Number(event.target.value)
          // A live preview only — the choice settles (and persists) on
          // blur, so a rejected edit's prefix never sticks.
          if (isValidBarsPerRow(bars)) {
            onChange(bars)
          }
        }}
        onBlur={() => {
          const bars = Number(barsDraft)
          if (barsDraft !== undefined && isValidBarsPerRow(bars)) {
            settledBars.current = bars
            storeBarsPerRow(bars)
          } else {
            onChange(settledBars.current)
          }
          setBarsDraft(undefined)
          setBarsBadInput(false)
        }}
        aria-invalid={barsDraftInvalid || undefined}
        aria-label={t({
          id: 'chords.bars-per-row',
          message: 'Mesures par ligne'
        })}
      />
      {t({ id: 'chords.bars-per-row-unit', message: 'mes. / ligne' })}
    </span>
  )
}
