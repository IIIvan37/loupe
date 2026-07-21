import type { ReactNode } from 'react'
import { CommitNumberField } from '../ui/commit-number-field.tsx'
import styles from './transport-bar.module.css'

interface StepperFieldProps {
  /** The visible caption (« Vitesse », « Hauteur »). */
  readonly label: ReactNode
  /** Current whole value, shared by the slider and the editable read-out. */
  readonly value: number
  readonly min: number
  readonly max: number
  readonly disabled: boolean
  /** aria-label for the range slider. */
  readonly sliderLabel: string
  /** Tooltip on the slider — includes the « double-clic = neutre » note. */
  readonly sliderTitle: string
  /** aria-label for the editable numeric read-out. */
  readonly fieldLabel: string
  readonly stepDownLabel: string
  readonly stepUpLabel: string
  /** Unit shown after the read-out (« % »), omitted when the label says it. */
  readonly unit?: ReactNode
  /** Value a double-click on the slider returns to (100 %, 0 st). */
  readonly neutral: number
  /** Whether a typed number would be taken verbatim (N.4 flagging). */
  readonly isValid: (value: number) => boolean
  /** Set an absolute value — the slider, a committed edit, the neutral reset. */
  readonly onSetValue: (value: number) => void
  /** Nudge one grain via the ± buttons — the SAME pure step as `[`/`]`. */
  readonly onStep: (direction: -1 | 1) => void
}

/**
 * A speed/pitch control wearing the zoom-pill idiom (AL.3): − / + step
 * buttons flank the slider, and the read-out is a click-to-edit
 * `CommitNumberField` instead of a static span. Double-clicking the slider
 * returns to neutral (the shared « retour neutre » gesture). Dumb: every
 * value flows back out through `onSetValue` / `onStep`.
 */
export function StepperField({
  label,
  value,
  min,
  max,
  disabled,
  sliderLabel,
  sliderTitle,
  fieldLabel,
  stepDownLabel,
  stepUpLabel,
  unit,
  neutral,
  isValid,
  onSetValue,
  onStep
}: StepperFieldProps) {
  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <div className={styles.stepperRow}>
        <button
          type="button"
          className={styles.step}
          aria-label={stepDownLabel}
          disabled={disabled || value <= min}
          onClick={() => onStep(-1)}
        >
          −
        </button>
        <input
          type="range"
          className={styles.slider}
          data-accent="amber"
          min={min}
          max={max}
          value={value}
          aria-label={sliderLabel}
          disabled={disabled}
          title={sliderTitle}
          onChange={(event) => onSetValue(event.target.valueAsNumber)}
          onDoubleClick={() => onSetValue(neutral)}
        />
        <button
          type="button"
          className={styles.step}
          aria-label={stepUpLabel}
          disabled={disabled || value >= max}
          onClick={() => onStep(1)}
        >
          +
        </button>
        <span className={styles.fineTuneRow}>
          <CommitNumberField
            value={value}
            min={min}
            max={max}
            className={styles.fineTuneField}
            disabled={disabled}
            label={fieldLabel}
            isValid={isValid}
            onCommit={onSetValue}
          />
          {unit !== undefined && (
            <span className={styles.fieldValue}>{unit}</span>
          )}
        </span>
      </div>
    </div>
  )
}
