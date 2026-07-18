// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '../../i18n/i18n.ts'
import { I18nTestingProvider } from '../../i18n/i18n-testing-provider.tsx'
import {
  ChordChartPanel,
} from './chord-chart-panel.tsx'
import { useChordChart } from './use-chord-chart.ts'

/** The panel as the shell hosts it: controlled by lifted session state. */
function Host({
  pitchSemitones = 0,
  header
}: {
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

describe('ChordChartPanel format help', () => {
  it('opens the format guide from the header', async () => {
    const user = userEvent.setup()
    render(<Host />, { wrapper: I18nTestingProvider })
    await user.click(
      screen.getByRole('button', { name: i18n._('chords.format-help') })
    )
    expect(
      screen.getByRole('heading', { name: i18n._('chords.format-help') })
    ).toBeInTheDocument()
  })

  it('teaches the repeat grammar with a concrete example', async () => {
    const user = userEvent.setup()
    render(<Host />, { wrapper: I18nTestingProvider })
    await user.click(
      screen.getByRole('button', { name: i18n._('chords.format-help') })
    )
    expect(screen.getByText('|: C | G :|')).toBeInTheDocument()
  })
})

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

  it('scrolls its own scrollport — never the page — to follow playback', () => {
    const { container, rerender } = render(
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
    // jsdom has no layout: fake a 100px scrollport over the sheet, and put
    // the next playing measure below its bottom edge (240–280).
    const port = container.querySelector<HTMLElement>(
      '[data-sheet-scrollport]'
    )
    if (!port) {
      throw new Error('the panel must declare its sheet scrollport')
    }
    Object.defineProperty(port, 'clientHeight', { value: 100 })
    Object.defineProperty(port, 'scrollHeight', { value: 400 })
    let portScrollTop = 0
    Object.defineProperty(port, 'scrollTop', {
      get: () => portScrollTop,
      set: (top: number) => {
        portScrollTop = top
      }
    })
    port.getBoundingClientRect = () => ({ top: 0 }) as DOMRect
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      top: 240,
      height: 40
    } as DOMRect)
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
    vi.restoreAllMocks()
    // The measure aligns to the scrollport's bottom edge; the regression was
    // scrollIntoView walking every ancestor and dragging the page along.
    expect(portScrollTop).toBe(180)
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

  it('a source that renders no chart stays unprintable', async () => {
    // '{fine}' parses to a form mark only — no sections, no directives, so
    // the sheet renders nothing and printing would output a blank page.
    const user = userEvent.setup()
    render(<Host />, { wrapper: I18nTestingProvider })
    await typeGrid(user, '{{fine}')
    expect(
      screen.getByRole('button', { name: printName() })
    ).toBeDisabled()
  })

  it('directives alone print — the chart head is page content', async () => {
    const user = userEvent.setup()
    render(<Host />, { wrapper: I18nTestingProvider })
    await typeGrid(user, '{{title: Your Song}')
    expect(
      screen.getByRole('button', { name: printName() })
    ).toBeEnabled()
  })
})
