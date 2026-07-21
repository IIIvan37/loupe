import {
  MAX_TEMPO_PERCENT,
  MIN_TEMPO_PERCENT,
  previewSpeedTrainer
} from '@app/core'
import { Trans, useLingui } from '@lingui/react/macro'
import { type KeyboardEvent, memo, useState } from 'react'
import { cx } from '../../lib/cx.ts'
import { LiveStatus } from '../ui/live-status.tsx'
import { PopoverForm } from '../ui/popover-form.tsx'
import styles from './speed-trainer-controls.module.css'
import type { SpeedTrainer } from './use-speed-trainer.ts'

/** Sensible practice defaults: start slow, one loop pass per +5 % step. */
const DEFAULT_FORM = {
  startPercent: '70',
  incrementPercent: '5',
  passesPerStep: '1',
  targetPercent: '100'
}

/**
 * An emptied field must reach the domain as `NaN` (its documented full-speed
 * fallback) — `Number('')` is 0, which would clamp to the 25 % floor instead.
 */
function fieldNumber(value: string): number {
  return value.trim() === '' ? Number.NaN : Number(value)
}

interface SpeedTrainerControlsProps {
  readonly trainer: SpeedTrainer
  /** Whether the loop is active — the ramp needs wraps to earn its steps. When
   * false the entry point shows disabled with a tooltip rather than hiding, so
   * the practice feature stays discoverable (AL.4). */
  readonly enabled: boolean
}

/**
 * Dumb controls for the speed-trainer ramp riding the active loupe. Off: a
 * popover form (start / increment / passes per step / target — the domain
 * normalises whatever is typed, an emptied field reads as full speed). On: the
 * ramp read-out plus « Arrêter » — the earned tempo stays where the ramp left
 * it. Each earned step is announced through the persistent LiveStatus channel.
 * Memoised: its host re-renders once per animation frame during playback, and
 * nothing here changes until the trainer (stable-identity hook) or copy does.
 */
export const SpeedTrainerControls = memo(function SpeedTrainerControls({
  trainer,
  enabled
}: SpeedTrainerControlsProps) {
  const { t } = useLingui()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(DEFAULT_FORM)

  function onOpenChange(next: boolean): void {
    // Reseed on open so a cancelled configuration is forgotten.
    if (next) {
      setForm(DEFAULT_FORM)
    }
    setOpen(next)
  }

  function start(): void {
    trainer.start({
      startPercent: fieldNumber(form.startPercent),
      incrementPercent: fieldNumber(form.incrementPercent),
      passesPerStep: fieldNumber(form.passesPerStep),
      targetPercent: fieldNumber(form.targetPercent)
    })
    setOpen(false)
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    // Enter submits, like every sibling popover form (NameEditor, URL import).
    if (event.key === 'Enter') {
      event.preventDefault()
      start()
    }
  }

  const field = (
    key: keyof typeof DEFAULT_FORM,
    label: string,
    min: number,
    max: number
  ) => (
    <label className={cx(styles.field)}>
      <span className={cx(styles.label)}>{label}</span>
      <input
        className={cx(styles.input)}
        type="number"
        min={min}
        max={max}
        value={form[key]}
        onChange={(event) => setForm({ ...form, [key]: event.target.value })}
        onKeyDown={onKeyDown}
      />
    </label>
  )

  // Off-loop: keep the entry point visible but inert, with a tooltip that
  // explains the prerequisite — a hidden control teaches nobody (AL.4).
  if (!enabled) {
    return (
      <button
        type="button"
        className={cx(styles.ghost)}
        disabled
        title={t({
          id: 'loops.trainer-needs-loop',
          message: 'Activez la boucle pour lancer la rampe de tempo'
        })}
      >
        <Trans id="loops.trainer-open">Rampe de tempo</Trans>
      </button>
    )
  }

  if (trainer.state) {
    const currentPercent = trainer.state.currentPercent
    const targetPercent = trainer.state.policy.targetPercent
    const status = t({
      id: 'loops.trainer-status',
      message: `Rampe ${currentPercent} % → ${targetPercent} %`
    })
    return (
      <>
        <span className={cx(styles.status)}>{status}</span>
        <button
          type="button"
          className={cx(styles.ghost)}
          onClick={trainer.stop}
        >
          <Trans id="loops.trainer-stop">Arrêter la rampe</Trans>
        </button>
        {/* Speaks the start tempo on arm, then each earned step. */}
        <LiveStatus message={status} />
      </>
    )
  }

  // Live summary of the ramp the current form would run — derived from the
  // SAME normalisation as the armed ramp, so it never promises a different
  // practice (an emptied target reads as full speed, a target below the start
  // collapses to one level, etc.).
  const preview = previewSpeedTrainer({
    startPercent: fieldNumber(form.startPercent),
    incrementPercent: fieldNumber(form.incrementPercent),
    passesPerStep: fieldNumber(form.passesPerStep),
    targetPercent: fieldNumber(form.targetPercent)
  })
  const stepsLabel =
    preview.stepCount === 1
      ? t({ id: 'loops.trainer-steps-one', message: '1 palier' })
      : t({
          id: 'loops.trainer-steps',
          message: `${preview.stepCount} paliers`
        })
  const previewLine =
    preview.passesPerStep === 1
      ? t({
          id: 'loops.trainer-preview',
          message: `${preview.startPercent} → ${preview.targetPercent} % · ${stepsLabel} de +${preview.incrementPercent} %`
        })
      : t({
          id: 'loops.trainer-preview-passes',
          message: `${preview.startPercent} → ${preview.targetPercent} % · ${stepsLabel} de +${preview.incrementPercent} % · ${preview.passesPerStep} répétitions/palier`
        })

  return (
    <PopoverForm
      open={open}
      onOpenChange={onOpenChange}
      triggerClassName={cx(styles.ghost)}
      triggerContent={<Trans id="loops.trainer-open">Rampe de tempo</Trans>}
      title={<Trans id="loops.trainer-title">Rampe de tempo</Trans>}
      popupClassName={cx(styles.popup)}
      submitLabel={<Trans id="loops.trainer-start">Démarrer</Trans>}
      onSubmit={start}
    >
      {field(
        'startPercent',
        t({ id: 'loops.trainer-start-percent', message: 'Départ (%)' }),
        MIN_TEMPO_PERCENT,
        MAX_TEMPO_PERCENT
      )}
      {field(
        'incrementPercent',
        t({ id: 'loops.trainer-increment', message: 'Incrément (%)' }),
        1,
        50
      )}
      {field(
        'passesPerStep',
        t({
          id: 'loops.trainer-passes',
          message: 'Répétitions par palier'
        }),
        1,
        99
      )}
      {field(
        'targetPercent',
        t({ id: 'loops.trainer-target', message: 'Plafond (%)' }),
        MIN_TEMPO_PERCENT,
        MAX_TEMPO_PERCENT
      )}
      {/* The ramp this form will run, in one line, before « Démarrer ». */}
      <p className={cx(styles.preview)}>{previewLine}</p>
    </PopoverForm>
  )
})
