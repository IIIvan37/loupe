import { Trans } from '@lingui/react/macro'
import styles from './undetected-stems.module.css'

/** The stems adaptive detection masked as near-silent (only id + label needed). */
interface UndetectedStem {
  readonly id: string
  readonly label: string
}

interface UndetectedStemsProps {
  readonly stems: readonly UndetectedStem[]
}

/**
 * Dumb gutter caption naming the stems the separation masked as near-silent,
 * sat under the mixer's stem headers it qualifies. Renders nothing when every
 * stem was detected.
 */
export function UndetectedStems({ stems }: UndetectedStemsProps) {
  if (stems.length === 0) {
    return null
  }
  return (
    <p className={styles.undetected}>
      <span className={styles.label}>
        <Trans id="mixer.undetected">Non détectés</Trans>
      </span>{' '}
      <span>{stems.map((stem) => stem.label).join(' · ')}</span>
    </p>
  )
}
