import type { LoopRegion } from '@app/core'
import { Trans, useLingui } from '@lingui/react/macro'
import { Cluster } from '../../layout/cluster/cluster.tsx'
import { cx } from '../../lib/cx.ts'
import { Icon } from '../ui/icon.tsx'
import { NameEditor } from '../ui/name-editor.tsx'
import styles from './loop-controls.module.css'
import { SpeedTrainerControls } from './speed-trainer-controls.tsx'
import type { SpeedTrainer } from './use-speed-trainer.ts'

interface LoopControlsProps {
  /** The active A/B region (drag on the waveform), or undefined when none. */
  readonly region: LoopRegion | undefined
  /** Whether the active region already belongs to a saved loop. */
  readonly isSaved: boolean
  /** Whether the active region loops playback (vs playing through). */
  readonly loopEnabled: boolean
  readonly onToggleLoop: () => void
  /** Save the active region under a name (a fresh saved loop). */
  readonly onSaveRegion: (name: string, region: LoopRegion) => void
  readonly onClearRegion: () => void
  /** The speed-trainer ramp riding this loupe. */
  readonly trainer: SpeedTrainer
}

/**
 * Dumb inline controls for the active A/B selection: loop it on/off, name and
 * save it, or discard a throwaway one. The saved-loop library it feeds lives in
 * the sidebar; a loop's start/end are edited on the waveform handles, not here.
 * Renders nothing until a region is selected.
 */
export function LoopControls({
  region,
  isSaved,
  loopEnabled,
  onToggleLoop,
  onSaveRegion,
  onClearRegion,
  trainer
}: LoopControlsProps) {
  const { t } = useLingui()
  const saveRegionLabel = t({
    id: 'loops.save-region',
    message: 'Enregistrer la boucle'
  })

  if (!region) {
    return null
  }

  return (
    <Cluster gap="var(--space-xs)" align="center">
      <span className={styles.label}>
        <Trans id="loops.section-label">Boucles</Trans>
      </span>
      <button
        type="button"
        className={cx(styles.toggle, loopEnabled && styles.toggleOn)}
        aria-pressed={loopEnabled}
        onClick={onToggleLoop}
      >
        <Icon name="loop" />
        {loopEnabled ? (
          <Trans id="loops.active">Boucle active</Trans>
        ) : (
          <Trans id="loops.inactive">Boucle inactive</Trans>
        )}
      </button>
      <SpeedTrainerControls trainer={trainer} />
      {!isSaved && (
        <>
          <NameEditor
            title={saveRegionLabel}
            triggerClassName={cx(styles.action)}
            triggerLabel={saveRegionLabel}
            triggerContent={saveRegionLabel}
            submitLabel={t({ id: 'common.save', message: 'Enregistrer' })}
            initialName=""
            onSubmit={(name) => onSaveRegion(name, region)}
          />
          {/* Discard a throwaway selection. A saved loop is removed from its
              sidebar row (✕) instead, so the two actions never overlap. */}
          <button type="button" className={styles.ghost} onClick={onClearRegion}>
            <Trans id="loops.clear-region">Effacer</Trans>
          </button>
        </>
      )}
    </Cluster>
  )
}
