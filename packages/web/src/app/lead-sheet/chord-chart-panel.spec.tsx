// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { i18n } from '../../i18n/i18n.ts'
import { I18nTestingProvider } from '../../i18n/i18n-testing-provider.tsx'
import {
  ChordChartPanel,
  type ChordDetectionProps
} from './chord-chart-panel.tsx'
import { useChordChart } from './use-chord-chart.ts'

/** The panel as the shell hosts it: controlled by lifted session state. */
function Host({
  detection,
  pitchSemitones = 0
}: {
  detection?: ChordDetectionProps
  pitchSemitones?: number
}) {
  const chart = useChordChart()
  return (
    <ChordChartPanel
      source={chart.source}
      onSourceChange={chart.setSource}
      onTranspose={chart.transpose}
      transposedBy={chart.transposedBy}
      pitchSemitones={pitchSemitones}
      detection={detection}
    />
  )
}

describe('ChordChartPanel', () => {
  it('renders the lead-sheet live from the typed grid', async () => {
    const user = userEvent.setup()
    render(<Host />, { wrapper: I18nTestingProvider })
    await user.type(screen.getByRole('textbox'), '| Am |')
    expect(screen.getByText('Am')).toBeInTheDocument()
  })

  it('transposes the whole grid up a semitone', async () => {
    const user = userEvent.setup()
    render(<Host />, { wrapper: I18nTestingProvider })
    await user.type(screen.getByRole('textbox'), '| C | Am |')
    await user.click(
      screen.getByRole('button', { name: i18n._('chords.transpose-up') })
    )
    expect(screen.getByRole('textbox')).toHaveValue('| C# | A#m |')
  })

  it('lays the sheet out with the chosen bars per row', async () => {
    const user = userEvent.setup()
    const { container } = render(<Host />, { wrapper: I18nTestingProvider })
    await user.type(screen.getByRole('textbox'), '| C | Am |')
    const field = screen.getByRole('spinbutton', {
      name: i18n._('chords.bars-per-row')
    })
    await user.clear(field)
    await user.type(field, '6')
    const sheet = [...container.querySelectorAll<HTMLElement>('div')].find(
      (div) => div.style.getPropertyValue('--bars-per-row') !== ''
    )
    expect(sheet?.style.getPropertyValue('--bars-per-row')).toBe('6')
  })

  it('an emptied bars-per-row field keeps the previous layout', async () => {
    const user = userEvent.setup()
    const { container } = render(<Host />, { wrapper: I18nTestingProvider })
    await user.type(screen.getByRole('textbox'), '| C | Am |')
    const field = screen.getByRole('spinbutton', {
      name: i18n._('chords.bars-per-row')
    })
    await user.clear(field)
    await user.type(field, '6')
    await user.clear(field)
    const sheet = [...container.querySelectorAll<HTMLElement>('div')].find(
      (div) => div.style.getPropertyValue('--bars-per-row') !== ''
    )
    expect(sheet?.style.getPropertyValue('--bars-per-row')).toBe('6')
  })

  it('transposes the whole grid down a semitone', async () => {
    const user = userEvent.setup()
    render(<Host />, { wrapper: I18nTestingProvider })
    await user.type(screen.getByRole('textbox'), '| C | Am |')
    await user.click(
      screen.getByRole('button', { name: i18n._('chords.transpose-down') })
    )
    expect(screen.getByRole('textbox')).toHaveValue('| B | G#m |')
  })
})

function detectionOf(
  overrides: Partial<ChordDetectionProps> = {}
): ChordDetectionProps {
  return {
    blockedReason: undefined,
    detecting: false,
    error: undefined,
    succeeded: false,
    onDetect: () => {},
    ...overrides
  }
}

describe('ChordChartPanel long grids', () => {
  // A detected chart covers the whole track: ~120 measures in one click. The
  // panel must absorb any N without stretching the page (K.1).
  const longSource = Array.from(
    { length: 30 },
    () => '| C | Am | F | G |'
  ).join('\n')

  it('hosts the sheet in a bounded scrollport', () => {
    const { container } = render(
      <ChordChartPanel
        source={longSource}
        onSourceChange={() => {}}
        onTranspose={() => {}}
        pitchSemitones={0}
        transposedBy={0}
      />,
      { wrapper: I18nTestingProvider }
    )
    const viewport = container.querySelector('[class*="sheetViewport"]')
    expect(viewport?.querySelectorAll('[class*="measure"]')).toHaveLength(120)
  })

  it('scrolls the playing measure into view when playback reaches it', () => {
    const scrolls = vi.fn()
    Element.prototype.scrollIntoView = scrolls
    const { rerender } = render(
      <ChordChartPanel
        source={longSource}
        onSourceChange={() => {}}
        onTranspose={() => {}}
        pitchSemitones={0}
        transposedBy={0}
        currentMeasureIndex={0}
      />,
      { wrapper: I18nTestingProvider }
    )
    scrolls.mockClear()
    rerender(
      <ChordChartPanel
        source={longSource}
        onSourceChange={() => {}}
        onTranspose={() => {}}
        pitchSemitones={0}
        transposedBy={0}
        currentMeasureIndex={42}
      />
    )
    expect(scrolls).toHaveBeenCalledWith({ block: 'nearest' })
  })

  it('keeps the playing measure marked for assistive tech on long grids', () => {
    render(
      <ChordChartPanel
        source={longSource}
        onSourceChange={() => {}}
        onTranspose={() => {}}
        pitchSemitones={0}
        transposedBy={0}
        currentMeasureIndex={42}
      />,
      { wrapper: I18nTestingProvider }
    )
    expect(document.querySelectorAll('[aria-current="true"]')).toHaveLength(1)
  })
})

describe('ChordChartPanel detection', () => {
  it('runs the detection with the panel layout on an empty grid', async () => {
    const user = userEvent.setup()
    const onDetect = vi.fn()
    render(
      <Host detection={detectionOf({ onDetect })} />,
      { wrapper: I18nTestingProvider }
    )
    await user.click(
      screen.getByRole('button', { name: i18n._('chords.detect') })
    )
    expect(onDetect).toHaveBeenCalledWith(4)
  })

  it('asks to confirm before overwriting a non-empty grid', async () => {
    const user = userEvent.setup()
    const onDetect = vi.fn()
    render(
      <Host detection={detectionOf({ onDetect })} />,
      { wrapper: I18nTestingProvider }
    )
    await user.type(screen.getByRole('textbox'), '| C |')
    await user.click(
      screen.getByRole('button', { name: i18n._('chords.detect') })
    )
    // First activation only arms the confirmation.
    expect(onDetect).not.toHaveBeenCalled()
    await user.click(
      screen.getByRole('button', { name: i18n._('chords.detect-confirm') })
    )
    expect(onDetect).toHaveBeenCalledWith(4)
  })

  it('disables the button and says why while the tempo grid is missing', () => {
    render(
      <Host detection={detectionOf({ blockedReason: 'no-grid' })} />,
      { wrapper: I18nTestingProvider }
    )
    expect(
      screen.getByRole('button', { name: i18n._('chords.detect') })
    ).toBeDisabled()
    expect(
      screen.getByText(i18n._('chords.detect-needs-grid'))
    ).toBeInTheDocument()
  })

  it('says the server is required when it is not ready', () => {
    render(
      <Host detection={detectionOf({ blockedReason: 'server' })} />,
      { wrapper: I18nTestingProvider }
    )
    expect(
      screen.getByText(i18n._('chords.detect-needs-server'))
    ).toBeInTheDocument()
  })

  it('announces the busy run and shows the failure', () => {
    const { rerender } = render(
      <Host detection={detectionOf({ detecting: true })} />,
      { wrapper: I18nTestingProvider }
    )
    expect(screen.getByRole('status')).toHaveTextContent(
      i18n._('chords.detecting')
    )
    rerender(
      <Host detection={detectionOf({ error: 'chord engine down' })} />
    )
    // The visible line carries the translated failure + the raw detail; the
    // live region only speaks the translated part.
    expect(screen.getByText(/chord engine down/)).toHaveTextContent(
      i18n._('chords.detect-failed')
    )
    expect(screen.getByRole('status')).toHaveTextContent(
      i18n._('chords.detect-failed')
    )
  })

  it('announces the landed draft', () => {
    render(<Host detection={detectionOf({ succeeded: true })} />, {
      wrapper: I18nTestingProvider
    })
    expect(screen.getByRole('status')).toHaveTextContent(
      i18n._('chords.detect-done')
    )
  })

  it('renders no detection controls when the feature is not wired', () => {
    render(<Host />, { wrapper: I18nTestingProvider })
    expect(
      screen.queryByRole('button', { name: i18n._('chords.detect') })
    ).not.toBeInTheDocument()
  })
})

describe('ChordChartPanel pitch divergence', () => {
  const followName = () => i18n._('chords.follow-pitch')

  /** The follow action is two-step: first activation arms the confirmation. */
  async function follow(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: followName() }))
    await user.click(
      screen.getByRole('button', { name: i18n._('chords.follow-pitch-confirm') })
    )
  }

  it('flags the grid when the audio pitch shift leaves it behind', async () => {
    const user = userEvent.setup()
    render(<Host pitchSemitones={2} />, { wrapper: I18nTestingProvider })
    await user.type(screen.getByRole('textbox'), '| C | Am |')
    expect(
      screen.getByText(i18n._('chords.pitch-mismatch', { pitch: '+2', grid: '0' }))
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: followName() })
    ).toBeInTheDocument()
  })

  it('following transposes the grid by the gap and clears the flag', async () => {
    const user = userEvent.setup()
    render(<Host pitchSemitones={2} />, { wrapper: I18nTestingProvider })
    await user.type(screen.getByRole('textbox'), '| C | Am |')
    await follow(user)
    expect(screen.getByRole('textbox')).toHaveValue('| D | Bm |')
    expect(
      screen.queryByRole('button', { name: followName() })
    ).not.toBeInTheDocument()
    // The rewrite is announced — the button just vanished from under focus.
    expect(screen.getByText(i18n._('chords.followed'))).toBeInTheDocument()
  })

  it('rewriting the whole grid asks to confirm first', async () => {
    const user = userEvent.setup()
    render(<Host pitchSemitones={2} />, { wrapper: I18nTestingProvider })
    await user.type(screen.getByRole('textbox'), '| C |')
    await user.click(screen.getByRole('button', { name: followName() }))
    // First activation only arms — the grid is untouched.
    expect(screen.getByRole('textbox')).toHaveValue('| C |')
  })

  it('a manual transpose counts toward the same offset', async () => {
    const user = userEvent.setup()
    render(<Host pitchSemitones={1} />, { wrapper: I18nTestingProvider })
    await user.type(screen.getByRole('textbox'), '| C |')
    await user.click(
      screen.getByRole('button', { name: i18n._('chords.transpose-up') })
    )
    // The grid now sits a semitone up, exactly where the audio is.
    expect(
      screen.queryByRole('button', { name: followName() })
    ).not.toBeInTheDocument()
  })

  it('a transposed grid over an untouched pitch diverges too', async () => {
    const user = userEvent.setup()
    render(<Host pitchSemitones={0} />, { wrapper: I18nTestingProvider })
    await user.type(screen.getByRole('textbox'), '| C |')
    await user.click(
      screen.getByRole('button', { name: i18n._('chords.transpose-down') })
    )
    expect(
      screen.getByText(i18n._('chords.pitch-mismatch', { pitch: '0', grid: '-1' }))
    ).toBeInTheDocument()
    // Following brings the grid back to the heard key.
    await follow(user)
    expect(screen.getByRole('textbox')).toHaveValue('| C |')
  })

  it('stays quiet while the grid is empty — nothing to transpose', () => {
    render(<Host pitchSemitones={2} />, { wrapper: I18nTestingProvider })
    expect(
      screen.queryByRole('button', { name: followName() })
    ).not.toBeInTheDocument()
  })

  it('stays quiet while grid and audio agree', async () => {
    const user = userEvent.setup()
    render(<Host pitchSemitones={0} />, { wrapper: I18nTestingProvider })
    await user.type(screen.getByRole('textbox'), '| C |')
    expect(
      screen.queryByRole('button', { name: followName() })
    ).not.toBeInTheDocument()
  })

  it('an octave apart names the same chords — no false flag at ±12', async () => {
    const user = userEvent.setup()
    render(<Host pitchSemitones={12} />, { wrapper: I18nTestingProvider })
    await user.type(screen.getByRole('textbox'), '| C |')
    expect(
      screen.queryByRole('button', { name: followName() })
    ).not.toBeInTheDocument()
  })

  it('transposing an empty grid leaves no invisible offset behind', async () => {
    const user = userEvent.setup()
    render(<Host pitchSemitones={0} />, { wrapper: I18nTestingProvider })
    await user.click(
      screen.getByRole('button', { name: i18n._('chords.transpose-up') })
    )
    await user.type(screen.getByRole('textbox'), '| C |')
    // The blank-grid click counted for nothing: grid and audio still agree.
    expect(
      screen.queryByRole('button', { name: followName() })
    ).not.toBeInTheDocument()
  })
})
