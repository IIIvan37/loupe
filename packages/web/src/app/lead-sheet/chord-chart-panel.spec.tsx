// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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
  pitchSemitones = 0,
  header
}: {
  detection?: ChordDetectionProps
  pitchSemitones?: number
  header?: { title?: string; bpm?: number }
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
      header={header}
    />
  )
}

// The bars-per-row preference rides localStorage — never let one test's
// layout leak into the next.
beforeEach(() => localStorage.clear())

/** The default view is the chart alone — editing starts behind « Modifier ». */
async function openEditor(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: i18n._('chords.edit') }))
}

/** Type into the source editor, unfolding it first if it is still closed. */
async function typeGrid(user: ReturnType<typeof userEvent.setup>, text: string) {
  if (!screen.queryByRole('textbox')) {
    await openEditor(user)
  }
  await user.type(screen.getByRole('textbox'), text)
}

describe('ChordChartPanel collapsed editing', () => {
  it('folds the source editor away by default — the chart is the view', () => {
    render(<Host />, { wrapper: I18nTestingProvider })
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('« Modifier » unfolds the editor and hands it the focus', async () => {
    const user = userEvent.setup()
    render(<Host />, { wrapper: I18nTestingProvider })
    await openEditor(user)
    expect(screen.getByRole('textbox')).toHaveFocus()
  })

  it('the toggle says whether the editor is open', async () => {
    const user = userEvent.setup()
    render(<Host />, { wrapper: I18nTestingProvider })
    const toggle = screen.getByRole('button', { name: i18n._('chords.edit') })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
  })

  it('the toggle names the editor it controls', async () => {
    const user = userEvent.setup()
    render(<Host />, { wrapper: I18nTestingProvider })
    await openEditor(user)
    const toggle = screen.getByRole('button', { name: i18n._('chords.edit') })
    expect(toggle).toHaveAttribute(
      'aria-controls',
      screen.getByRole('textbox').id
    )
  })

  it('an empty folded grid invites the user to type or detect', () => {
    render(<Host />, { wrapper: I18nTestingProvider })
    expect(
      screen.getByText(i18n._('chords.empty-hint'))
    ).toBeInTheDocument()
  })

  it('the invitation yields to the editor and to a typed grid', async () => {
    const user = userEvent.setup()
    render(<Host />, { wrapper: I18nTestingProvider })
    await typeGrid(user, '| C |')
    expect(
      screen.queryByText(i18n._('chords.empty-hint'))
    ).not.toBeInTheDocument()
  })

  it('the same toggle folds the editor back — the text survives', async () => {
    const user = userEvent.setup()
    render(<Host />, { wrapper: I18nTestingProvider })
    await openEditor(user)
    await typeGrid(user,'| Am |')
    await user.click(screen.getByRole('button', { name: i18n._('chords.edit') }))
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    // The chart still renders the typed grid — only the view folded.
    expect(screen.getByText('Am')).toBeInTheDocument()
  })
})

describe('ChordChartPanel', () => {
  it('renders the lead-sheet live from the typed grid', async () => {
    const user = userEvent.setup()
    render(<Host />, { wrapper: I18nTestingProvider })
    await typeGrid(user,'| Am |')
    expect(screen.getByText('Am')).toBeInTheDocument()
  })

  it('prints the session-derived chart head over the sheet', async () => {
    const user = userEvent.setup()
    render(<Host header={{ title: 'Your Song', bpm: 128 }} />, {
      wrapper: I18nTestingProvider
    })
    await typeGrid(user,'| C |')
    expect(screen.getByText('♩ = 128')).toBeInTheDocument()
  })

  it('transposes the whole grid up a semitone', async () => {
    const user = userEvent.setup()
    render(<Host />, { wrapper: I18nTestingProvider })
    await typeGrid(user,'| C | Am |')
    await user.click(
      screen.getByRole('button', { name: i18n._('chords.transpose-up') })
    )
    expect(screen.getByRole('textbox')).toHaveValue('| C# | A#m |')
  })

  it('lays the sheet out with the chosen bars per row', async () => {
    const user = userEvent.setup()
    const { container } = render(<Host />, { wrapper: I18nTestingProvider })
    await typeGrid(user,'| C | Am |')
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
    await typeGrid(user,'| C | Am |')
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

  it('flags an out-of-range bars-per-row draft instead of ignoring it', async () => {
    const user = userEvent.setup()
    render(<Host />, { wrapper: I18nTestingProvider })
    const field = screen.getByRole('spinbutton', {
      name: i18n._('chords.bars-per-row')
    })
    await user.clear(field)
    await user.type(field, '20')
    expect(field).toHaveAttribute('aria-invalid', 'true')
  })

  it('an in-range bars-per-row draft carries no invalid flag', async () => {
    const user = userEvent.setup()
    render(<Host />, { wrapper: I18nTestingProvider })
    const field = screen.getByRole('spinbutton', {
      name: i18n._('chords.bars-per-row')
    })
    await user.clear(field)
    await user.type(field, '6')
    expect(field).not.toHaveAttribute('aria-invalid')
  })

  it('an emptied draft is transient, not invalid', async () => {
    const user = userEvent.setup()
    render(<Host />, { wrapper: I18nTestingProvider })
    const field = screen.getByRole('spinbutton', {
      name: i18n._('chords.bars-per-row')
    })
    await user.clear(field)
    expect(field).not.toHaveAttribute('aria-invalid')
  })

  it('leaving the field clears the rejected draft and the flag', async () => {
    const user = userEvent.setup()
    render(<Host />, { wrapper: I18nTestingProvider })
    const field = screen.getByRole('spinbutton', {
      name: i18n._('chords.bars-per-row')
    })
    await user.clear(field)
    await user.type(field, '20')
    await user.tab()
    expect(field).not.toHaveAttribute('aria-invalid')
    // The « 2 » keystroke previewed 2 bars per row, but the edit as a whole
    // was rejected — leaving the field falls back to the settled layout.
    expect(field).toHaveValue(4)
  })

  it('transposes the whole grid down a semitone', async () => {
    const user = userEvent.setup()
    render(<Host />, { wrapper: I18nTestingProvider })
    await typeGrid(user,'| C | Am |')
    await user.click(
      screen.getByRole('button', { name: i18n._('chords.transpose-down') })
    )
    expect(screen.getByRole('textbox')).toHaveValue('| B | G#m |')
  })
})

describe('ChordChartPanel bars-per-row preference', () => {
  // A render preference, not project data: it lives in localStorage so the
  // chosen layout survives reloads without touching the project manifest.
  it('remembers the chosen layout across panel lifetimes', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<Host />, { wrapper: I18nTestingProvider })
    const field = screen.getByRole('spinbutton', {
      name: i18n._('chords.bars-per-row')
    })
    await user.clear(field)
    await user.type(field, '6')
    await user.tab()
    unmount()
    render(<Host />, { wrapper: I18nTestingProvider })
    expect(
      screen.getByRole('spinbutton', { name: i18n._('chords.bars-per-row') })
    ).toHaveValue(6)
  })

  it('ignores a stored value the layout cannot use', () => {
    localStorage.setItem('loupe.chords.bars-per-row', '99')
    render(<Host />, { wrapper: I18nTestingProvider })
    expect(
      screen.getByRole('spinbutton', { name: i18n._('chords.bars-per-row') })
    ).toHaveValue(4)
  })

  it('a rejected edit never clobbers the stored preference', async () => {
    const user = userEvent.setup()
    localStorage.setItem('loupe.chords.bars-per-row', '6')
    render(<Host />, { wrapper: I18nTestingProvider })
    const field = screen.getByRole('spinbutton', {
      name: i18n._('chords.bars-per-row')
    })
    await user.clear(field)
    await user.type(field, '20')
    await user.tab()
    // « 2 » previewed mid-edit, but the edit was rejected as a whole: the
    // deliberate 6 survives in storage AND the field settles back on it.
    expect(localStorage.getItem('loupe.chords.bars-per-row')).toBe('6')
    expect(field).toHaveValue(6)
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
    await typeGrid(user,'| C |')
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
    rerender(<Host detection={detectionOf({ error: 'unknown' })} />)
    // The visible line is fully translated: prefix + the code's own copy —
    // no raw engine text ever reaches the UI (it goes to the console).
    expect(
      screen.getAllByText(new RegExp(i18n._('chords.error.unknown')))[0]
    ).toHaveTextContent(i18n._('chords.detect-failed'))
    // The live region speaks the actionable copy too — a screen-reader user
    // gets the same reason a sighted user reads.
    expect(screen.getByRole('status')).toHaveTextContent(
      i18n._('chords.error.unknown')
    )
  })

  it('explains a missing server engine in the user language', () => {
    render(<Host detection={detectionOf({ error: 'engine-unavailable' })} />, {
      wrapper: I18nTestingProvider
    })
    expect(
      screen.getAllByText(new RegExp(i18n._('chords.error.engine-unavailable'))).length
    ).toBeGreaterThan(0)
  })

  it('reuses the launch-the-server hint for an unreachable server', () => {
    render(<Host detection={detectionOf({ error: 'network' })} />, {
      wrapper: I18nTestingProvider
    })
    expect(
      screen.getAllByText(new RegExp(i18n._('chords.detect-needs-server'))).length
    ).toBeGreaterThan(0)
  })

  it('explains a server-side timeout in the user language', () => {
    render(<Host detection={detectionOf({ error: 'timeout' })} />, {
      wrapper: I18nTestingProvider
    })
    expect(
      screen.getAllByText(new RegExp(i18n._('chords.error.timeout'))).length
    ).toBeGreaterThan(0)
  })

  it('explains an oversized upload in the user language', () => {
    render(<Host detection={detectionOf({ error: 'too-large' })} />, {
      wrapper: I18nTestingProvider
    })
    expect(
      screen.getAllByText(new RegExp(i18n._('chords.error.too-large'))).length
    ).toBeGreaterThan(0)
  })

  it('explains an empty detection in the user language', () => {
    render(<Host detection={detectionOf({ error: 'no-chords' })} />, {
      wrapper: I18nTestingProvider
    })
    expect(
      screen.getAllByText(new RegExp(i18n._('chords.error.no-chords'))).length
    ).toBeGreaterThan(0)
  })

  it('reuses the detect-tempo-first hint for a gridless failure', () => {
    render(<Host detection={detectionOf({ error: 'no-downbeat' })} />, {
      wrapper: I18nTestingProvider
    })
    expect(
      screen.getAllByText(new RegExp(i18n._('chords.detect-needs-grid'))).length
    ).toBeGreaterThan(0)
  })

  it('announces the landed draft', () => {
    render(<Host detection={detectionOf({ succeeded: true })} />, {
      wrapper: I18nTestingProvider
    })
    expect(screen.getByRole('status')).toHaveTextContent(
      i18n._('chords.detect-done')
    )
  })

  it('keeps the primary action at the top — before the sheet, not below it', () => {
    const { container } = render(<Host detection={detectionOf()} />, {
      wrapper: I18nTestingProvider
    })
    const button = screen.getByRole('button', { name: i18n._('chords.detect') })
    const viewport = container.querySelector('[class*="sheetViewport"]')
    // A long grid pushes everything under it out of view (K.1 bounded the
    // sheet, but the action must not drift down with it).
    expect(
      button.compareDocumentPosition(viewport as Element) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
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
    await typeGrid(user,'| C | Am |')
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
    await typeGrid(user,'| C | Am |')
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
    await typeGrid(user,'| C |')
    await user.click(screen.getByRole('button', { name: followName() }))
    // First activation only arms — the grid is untouched.
    expect(screen.getByRole('textbox')).toHaveValue('| C |')
  })

  it('a manual transpose counts toward the same offset', async () => {
    const user = userEvent.setup()
    render(<Host pitchSemitones={1} />, { wrapper: I18nTestingProvider })
    await typeGrid(user,'| C |')
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
    await typeGrid(user,'| C |')
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
    await typeGrid(user,'| C |')
    expect(
      screen.queryByRole('button', { name: followName() })
    ).not.toBeInTheDocument()
  })

  it('an octave apart names the same chords — no false flag at ±12', async () => {
    const user = userEvent.setup()
    render(<Host pitchSemitones={12} />, { wrapper: I18nTestingProvider })
    await typeGrid(user,'| C |')
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
    await typeGrid(user,'| C |')
    // The blank-grid click counted for nothing: grid and audio still agree.
    expect(
      screen.queryByRole('button', { name: followName() })
    ).not.toBeInTheDocument()
  })
})

describe('ChordChartPanel printing (P.4)', () => {
  function printName() {
    return i18n._('chords.print')
  }

  it('offers nothing to print while the grid is empty', () => {
    render(<Host />, { wrapper: I18nTestingProvider })
    expect(
      screen.getByRole('button', { name: printName() })
    ).toBeDisabled()
  })

  it('hands a non-empty grid to the browser print dialog', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {})
    const user = userEvent.setup()
    render(<Host />, { wrapper: I18nTestingProvider })
    await typeGrid(user, '| C | Am |')
    await user.click(screen.getByRole('button', { name: printName() }))
    expect(print).toHaveBeenCalledTimes(1)
  })

  it('a whitespace-only grid stays unprintable', async () => {
    const user = userEvent.setup()
    render(<Host />, { wrapper: I18nTestingProvider })
    await typeGrid(user, '   ')
    expect(
      screen.getByRole('button', { name: printName() })
    ).toBeDisabled()
  })
})
