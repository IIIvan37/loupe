// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import type { SeparationState, StemSet } from '@app/core'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { I18nTestingProvider } from '../../i18n/i18n-testing-provider.tsx'
import { i18n } from '../../i18n/i18n.ts'
import {
  AnalyserRow,
  type ChordDetectionControl,
  type SeparationControl,
  type StructureDetectionControl,
  type TempoDetectionControl
} from './analyser-row.tsx'

const emptyTrack = { sampleRate: 4, durationSeconds: 1, waveform: { peaks: [] } }
const stems: StemSet = [
  { id: 'voix', label: 'Voix', track: emptyTrack, confidence: 1, present: true }
]

function separationState(partial: Partial<SeparationState>): SeparationState {
  return { status: 'idle', progress: 0, stems: [], error: undefined, ...partial }
}

function separationOf(
  overrides: Partial<SeparationControl> = {}
): SeparationControl {
  return {
    state: separationState({}),
    canSeparate: true,
    serverHealth: 'ready',
    onSeparate: vi.fn(),
    onCancel: vi.fn(),
    ...overrides
  }
}

function tempoOf(
  overrides: Partial<TempoDetectionControl> = {}
): TempoDetectionControl {
  return {
    bpm: undefined,
    detecting: false,
    error: undefined,
    onRetry: vi.fn(),
    onCancel: vi.fn(),
    ...overrides
  }
}

function structureOf(
  overrides: Partial<StructureDetectionControl> = {}
): StructureDetectionControl {
  return {
    blockedReason: undefined,
    detecting: false,
    error: undefined,
    succeeded: false,
    hasMarkers: false,
    hasGrid: false,
    onDetect: vi.fn(),
    onCancel: vi.fn(),
    ...overrides
  }
}

function chordsOf(
  overrides: Partial<ChordDetectionControl> = {}
): ChordDetectionControl {
  return {
    blockedReason: undefined,
    detecting: false,
    error: undefined,
    succeeded: false,
    hasGrid: false,
    onDetect: vi.fn(),
    onCancel: vi.fn(),
    ...overrides
  }
}

interface RowOverrides {
  readonly disabled?: boolean
  readonly separation?: Partial<SeparationControl>
  readonly tempo?: Partial<TempoDetectionControl>
  readonly structure?: Partial<StructureDetectionControl>
  readonly chords?: Partial<ChordDetectionControl>
}

function renderRow(overrides: RowOverrides = {}) {
  const props = {
    disabled: overrides.disabled ?? false,
    separation: separationOf(overrides.separation),
    tempo: tempoOf(overrides.tempo),
    structure: structureOf(overrides.structure),
    chords: chordsOf(overrides.chords)
  }
  const view = render(<AnalyserRow {...props} />, {
    wrapper: I18nTestingProvider
  })
  const rerenderRow = (next: RowOverrides) =>
    view.rerender(
      <AnalyserRow
        disabled={next.disabled ?? false}
        separation={separationOf(next.separation)}
        tempo={tempoOf(next.tempo)}
        structure={structureOf(next.structure)}
        chords={chordsOf(next.chords)}
      />
    )
  return { ...view, props, rerenderRow }
}

/** All live regions of the row, folded to one searchable text. */
function announcedText(): string {
  return screen
    .getAllByRole('status')
    .map((region) => region.textContent ?? '')
    .join(' ')
}

/* The step labels are mirrored into visually-hidden live regions for screen
 * readers; text queries assert the VISIBLE read-out, so skip that channel. */
const visibleOnly = { ignore: 'script, style, [role="status"]' }

describe('AnalyserRow separation', () => {
  it('separates the loaded track on demand', async () => {
    const user = userEvent.setup()
    const { props } = renderRow()
    await user.click(
      screen.getByRole('button', { name: i18n._('separation.separate') })
    )
    expect(props.separation.onSeparate).toHaveBeenCalledOnce()
  })

  it('disables the action until a track is loaded', () => {
    renderRow({ separation: { canSeparate: false } })
    expect(
      screen.getByRole('button', { name: i18n._('separation.separate') })
    ).toBeDisabled()
  })

  it('disables the action and explains when the server is offline', () => {
    renderRow({ separation: { serverHealth: 'offline' } })
    expect(
      screen.getByRole('button', { name: i18n._('separation.separate') })
    ).toBeDisabled()
    expect(
      screen.getByText(i18n._('separation.server-offline'))
    ).toBeInTheDocument()
  })

  it('keeps the action available while the server is still being probed', () => {
    // 'checking' is transient on boot — disabling here would flash the button
    // off then on. Only the definitive offline/no-separation states block.
    renderRow({ separation: { serverHealth: 'checking' } })
    expect(
      screen.getByRole('button', { name: i18n._('separation.separate') })
    ).toBeEnabled()
  })

  it('shows the running phase and progress, swapping the action for a cancel', () => {
    renderRow({
      separation: { state: separationState({ status: 'separating', progress: 0.4 }) }
    })
    expect(
      screen.getByText(i18n._('separation.separating'), visibleOnly)
    ).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('value', '40')
    expect(
      screen.queryByRole('button', { name: i18n._('separation.separate') })
    ).not.toBeInTheDocument()
  })

  it('cancels the running separation on demand', async () => {
    const user = userEvent.setup()
    const { props } = renderRow({
      separation: { state: separationState({ status: 'separating', progress: 0.4 }) }
    })
    await user.click(
      screen.getByRole('button', { name: i18n._('common.cancel') })
    )
    expect(props.separation.onCancel).toHaveBeenCalledOnce()
  })

  it('announces the running phase then the completion to screen readers', () => {
    const { rerenderRow } = renderRow()
    rerenderRow({
      separation: { state: separationState({ status: 'separating', progress: 0.4 }) }
    })
    expect(announcedText()).toContain(i18n._('separation.separating'))
    // The most important announcement of all: the button face steps aside
    // once the stems are ready, but the live region survives to say so.
    rerenderRow({
      separation: { state: separationState({ status: 'ready', progress: 1, stems }) }
    })
    expect(announcedText()).toContain(i18n._('separation.done'))
  })

  it('keeps the moving percentage out of the live regions', () => {
    // Steps are announced, the percentage is not — a polite region re-reading
    // every progress tick would drown the screen reader in numbers.
    renderRow({
      separation: { state: separationState({ status: 'separating', progress: 0.4 }) }
    })
    expect(announcedText()).not.toContain('40')
  })

  it('keeps a stable done face once the stems are ready', () => {
    // The row's footprint stays put (Q.2): a landed separation shows « ✓ »
    // instead of vanishing and reflowing the whole column.
    renderRow({
      separation: { state: separationState({ status: 'ready', progress: 1, stems }) }
    })
    expect(
      screen.getByText(i18n._('separation.done'), visibleOnly)
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: i18n._('separation.separate') })
    ).not.toBeInTheDocument()
  })

  it('surfaces a failure and offers a retry', async () => {
    const user = userEvent.setup()
    const { props } = renderRow({
      separation: {
        state: separationState({ status: 'error', error: 'moteur indisponible' })
      }
    })
    expect(
      screen.getByText(
        i18n._('separation.failed', { error: 'moteur indisponible' }),
        visibleOnly
      )
    ).toBeInTheDocument()
    await user.click(
      screen.getByRole('button', { name: i18n._('separation.retry') })
    )
    expect(props.separation.onSeparate).toHaveBeenCalledOnce()
  })
})

describe('AnalyserRow tempo', () => {
  it('shows nothing before any detection state exists', () => {
    renderRow()
    expect(
      screen.queryByText(i18n._('analyser.tempo-detecting'))
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText(i18n._('analyser.tempo-done'), visibleOnly)
    ).not.toBeInTheDocument()
  })

  it('shows the analysis in flight', () => {
    renderRow({ tempo: { detecting: true } })
    expect(
      screen.getByText(i18n._('analyser.tempo-detecting'))
    ).toBeInTheDocument()
  })

  it('wears a done face once the tempo is seated', () => {
    renderRow({ tempo: { bpm: 120 } })
    expect(
      screen.getByText(i18n._('analyser.tempo-done'), visibleOnly)
    ).toBeInTheDocument()
  })

  it('offers to retry when the detection failed', async () => {
    const user = userEvent.setup()
    const { props } = renderRow({ tempo: { error: 'network' } })
    await user.click(screen.getByRole('button', { name: i18n._('tempo.retry') }))
    expect(props.tempo.onRetry).toHaveBeenCalled()
  })

  it('explains the failure in the user language', () => {
    renderRow({ tempo: { error: 'engine-unavailable' } })
    expect(
      screen.getByText(i18n._('tempo.error.engine-unavailable'), visibleOnly)
    ).toBeInTheDocument()
  })
})

describe('AnalyserRow structure', () => {
  it('detects the structure straight away when no markers exist', async () => {
    const user = userEvent.setup()
    const { props } = renderRow()
    await user.click(
      screen.getByRole('button', { name: i18n._('structure.detect') })
    )
    expect(props.structure.onDetect).toHaveBeenCalledOnce()
  })

  it('confirms before replacing existing markers', async () => {
    const user = userEvent.setup()
    const { props } = renderRow({ structure: { hasMarkers: true } })

    // First click only arms the « Remplacer les repères ? » confirm.
    await user.click(
      screen.getByRole('button', { name: i18n._('structure.detect') })
    )
    expect(props.structure.onDetect).not.toHaveBeenCalled()

    await user.click(
      screen.getByRole('button', { name: i18n._('structure.detect-confirm') })
    )
    expect(props.structure.onDetect).toHaveBeenCalledOnce()
  })

  it('confirms before relabelling an existing grid, naming the grid', async () => {
    const user = userEvent.setup()
    const { props } = renderRow({ structure: { hasGrid: true } })
    await user.click(
      screen.getByRole('button', { name: i18n._('structure.detect') })
    )
    expect(props.structure.onDetect).not.toHaveBeenCalled()
    await user.click(
      screen.getByRole('button', {
        name: i18n._('structure.detect-confirm-grid')
      })
    )
    expect(props.structure.onDetect).toHaveBeenCalledOnce()
  })

  it('names both when markers and a grid are both at stake', async () => {
    const user = userEvent.setup()
    renderRow({ structure: { hasMarkers: true, hasGrid: true } })
    await user.click(
      screen.getByRole('button', { name: i18n._('structure.detect') })
    )
    expect(
      screen.getByRole('button', {
        name: i18n._('structure.detect-confirm-both')
      })
    ).toBeInTheDocument()
  })

  it('blocks detection while the server is unreachable, explaining why', () => {
    renderRow({ structure: { blockedReason: 'server' } })
    expect(
      screen.getByRole('button', { name: i18n._('structure.detect') })
    ).toBeDisabled()
    expect(
      screen.getByText(i18n._('structure.detect-needs-server'))
    ).toBeInTheDocument()
  })

  it('cancels an in-flight detection from the busy face', async () => {
    const user = userEvent.setup()
    const { props } = renderRow({ structure: { detecting: true } })
    await user.click(
      screen.getByRole('button', { name: i18n._('common.cancel') })
    )
    expect(props.structure.onCancel).toHaveBeenCalledOnce()
  })

  it('wears the operation line while a detection is in flight', () => {
    // R.1: the running face is a live bar + label, not a disabled button.
    renderRow({ structure: { detecting: true } })
    expect(
      screen.getByText(i18n._('structure.detecting-short'), {
        selector: 'span'
      })
    ).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: i18n._('structure.detect') })
    ).not.toBeInTheDocument()
  })

  it('surfaces a failed detection as an actionable line', () => {
    renderRow({ structure: { error: 'no-structure' } })
    // Shown in the visible line AND spoken through the live region — both
    // carry the same actionable text.
    expect(
      screen.getAllByText(
        `${i18n._('structure.detect-failed')} — ${i18n._('structure.error.no-structure')}`
      ).length
    ).toBeGreaterThan(0)
  })
})

describe('AnalyserRow chords', () => {
  it('runs the detection straight away on an empty grid', async () => {
    const user = userEvent.setup()
    const { props } = renderRow()
    await user.click(
      screen.getByRole('button', { name: i18n._('chords.detect') })
    )
    expect(props.chords.onDetect).toHaveBeenCalledOnce()
  })

  it('confirms before replacing a non-empty grid', async () => {
    const user = userEvent.setup()
    const { props } = renderRow({ chords: { hasGrid: true } })
    await user.click(
      screen.getByRole('button', { name: i18n._('chords.detect') })
    )
    expect(props.chords.onDetect).not.toHaveBeenCalled()
    await user.click(
      screen.getByRole('button', { name: i18n._('chords.detect-confirm') })
    )
    expect(props.chords.onDetect).toHaveBeenCalledOnce()
  })

  it('waits for a beat grid, explaining the tempo comes first', () => {
    renderRow({ chords: { blockedReason: 'no-grid' } })
    expect(
      screen.getByRole('button', { name: i18n._('chords.detect') })
    ).toBeDisabled()
    expect(
      screen.getByText(i18n._('chords.detect-needs-grid'))
    ).toBeInTheDocument()
  })

  it('blocks detection while the server is unreachable, explaining why', () => {
    renderRow({ chords: { blockedReason: 'server' } })
    expect(
      screen.getByText(i18n._('chords.detect-needs-server'))
    ).toBeInTheDocument()
  })

  it('announces the busy state, then interrupts with the failure', () => {
    const { rerenderRow } = renderRow({ chords: { detecting: true } })
    expect(announcedText()).toContain(i18n._('chords.detecting'))
    // Failures interrupt (role="alert") instead of riding the polite channel.
    rerenderRow({ chords: { error: 'unknown' } })
    expect(screen.getByRole('alert')).toHaveTextContent(
      i18n._('chords.detect-failed')
    )
  })

  it('maps every failure code to an actionable line', () => {
    renderRow({ chords: { error: 'engine-unavailable' } })
    expect(
      screen.getAllByText(
        new RegExp(i18n._('chords.error.engine-unavailable'))
      ).length
    ).toBeGreaterThan(0)
  })

  it('reuses the detect-tempo-first hint for a gridless failure', () => {
    renderRow({ chords: { error: 'no-downbeat' } })
    expect(
      screen.getAllByText(new RegExp(i18n._('chords.detect-needs-grid'))).length
    ).toBeGreaterThan(0)
  })

  it('announces the landed draft', () => {
    renderRow({ chords: { succeeded: true } })
    expect(announcedText()).toContain(i18n._('chords.detect-done'))
  })
})

describe('AnalyserRow disabled state', () => {
  it('disables the manual detections until a track is loaded', () => {
    renderRow({ disabled: true })
    expect(
      screen.getByRole('button', { name: i18n._('structure.detect') })
    ).toBeDisabled()
    expect(
      screen.getByRole('button', { name: i18n._('chords.detect') })
    ).toBeDisabled()
  })
})
