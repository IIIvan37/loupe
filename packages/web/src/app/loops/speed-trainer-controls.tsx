import { MAX_TEMPO_PERCENT, MIN_TEMPO_PERCENT } from '@app/core'
import { Popover } from '@base-ui-components/react/popover'
import { Trans, useLingui } from '@lingui/react/macro'
import { type KeyboardEvent, memo, useState } from 'react'
import { cx } from '../../lib/cx.ts'
import { LiveStatus } from '../ui/live-status.tsx'
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
  trainer
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

  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger className={cx(styles.ghost)}>
        <Trans id="loops.trainer-open">Rampe de tempo</Trans>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner className={cx(styles.positioner)} sideOffset={6}>
          <Popover.Popup className={cx(styles.popup)}>
            <Popover.Title className={cx(styles.title)}>
              <Trans id="loops.trainer-title">Rampe de tempo</Trans>
            </Popover.Title>
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
            <div className={cx(styles.actions)}>
              <Popover.Close className={cx(styles.ghost)}>
                <Trans id="common.cancel">Annuler</Trans>
              </Popover.Close>
              <button
                type="button"
                className={cx(styles.submit)}
                onClick={start}
              >
                <Trans id="loops.trainer-start">Démarrer</Trans>
              </button>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
})
