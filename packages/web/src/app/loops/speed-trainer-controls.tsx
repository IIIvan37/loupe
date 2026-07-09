import { MAX_PLAYBACK_RATE, MIN_PLAYBACK_RATE } from '@app/core'
import { Popover } from '@base-ui-components/react/popover'
import { Trans, useLingui } from '@lingui/react/macro'
import { useState } from 'react'
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

const MIN_TEMPO_PERCENT = MIN_PLAYBACK_RATE * 100
const MAX_TEMPO_PERCENT = MAX_PLAYBACK_RATE * 100

interface SpeedTrainerControlsProps {
  readonly trainer: SpeedTrainer
}

/**
 * Dumb controls for the speed-trainer ramp riding the active loupe. Off: a
 * popover form (start / increment / passes per step / target — the domain
 * normalises whatever is typed, an emptied field reads as full speed). On: the
 * ramp read-out plus « Arrêter » — the earned tempo stays where the ramp left
 * it. Each earned step is announced through the persistent LiveStatus channel.
 */
export function SpeedTrainerControls({ trainer }: SpeedTrainerControlsProps) {
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
      startPercent: Number(form.startPercent),
      incrementPercent: Number(form.incrementPercent),
      passesPerStep: Number(form.passesPerStep),
      targetPercent: Number(form.targetPercent)
    })
    setOpen(false)
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
}
