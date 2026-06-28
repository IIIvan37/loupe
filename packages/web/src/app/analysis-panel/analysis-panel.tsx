import { Tabs } from '@base-ui-components/react/tabs'
import { cx } from '../../lib/cx.ts'
import styles from './analysis-panel.module.css'

interface AnalysisTab {
  readonly id: string
  readonly label: string
  readonly hint: string
}

const TABS: readonly AnalysisTab[] = [
  { id: 'spectre', label: 'Spectre', hint: 'Analyse spectrale (Jalon 3).' },
  { id: 'reperes', label: 'Repères', hint: 'Marqueurs cliquables (Jalon 1).' },
  { id: 'notes', label: 'Notes', hint: 'Annotations textuelles.' }
]

/**
 * Dumb presentational analysis panel built on Base UI Tabs (headless + a11y).
 * Content is placeholder for Slice 0; real spectrum/markers/notes land later.
 */
export function AnalysisPanel() {
  return (
    <aside className={styles.panel}>
      <Tabs.Root defaultValue="spectre">
        <Tabs.List className={cx(styles.list)}>
          {TABS.map((tab) => (
            <Tabs.Tab key={tab.id} value={tab.id} className={cx(styles.tab)}>
              {tab.label}
            </Tabs.Tab>
          ))}
        </Tabs.List>
        {TABS.map((tab) => (
          <Tabs.Panel key={tab.id} value={tab.id} className={cx(styles.tabPanel)}>
            {tab.hint}
          </Tabs.Panel>
        ))}
      </Tabs.Root>
    </aside>
  )
}
