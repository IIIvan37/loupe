// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
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

describe('ChordChartPanel measure locus (AN.1)', () => {
  const source = '| C | G7 |\n| Am F |'

  function renderLocus(onSelectMeasure = vi.fn()) {
    render(
      <ChordChartPanel
        source={source}
        onSourceChange={() => {}}
        onTranspose={() => {}}
        pitchSemitones={0}
        transposedBy={0}
        onSelectMeasure={onSelectMeasure}
      />,
      { wrapper: I18nTestingProvider }
    )
    return onSelectMeasure
  }

  it('keeps the seek semantics while the editor is folded', async () => {
    const user = userEvent.setup()
    const onSelectMeasure = renderLocus()
    await user.click(
      screen.getByRole('button', {
        name: i18n._('chart.measure-seek', { number: 2 })
      })
    )
    expect(onSelectMeasure).toHaveBeenCalledWith(1)
  })

  it('clicking a measure while editing lands the cursor on its source token', async () => {
    const user = userEvent.setup()
    const onSelectMeasure = renderLocus()
    await openEditor(user)
    // The measure buttons now announce the locate action, not the seek.
    await user.click(
      screen.getByRole('button', {
        name: i18n._('chart.measure-locate', { number: 2 })
      })
    )
    const editor = screen.getByRole('textbox') as HTMLTextAreaElement
    expect(editor).toHaveFocus()
    // « G7 » selected: the span of written measure 2 in the source.
    expect(editor.selectionStart).toBe(6)
    expect(editor.selectionEnd).toBe(8)
    // Locating must not seek playback.
    expect(onSelectMeasure).not.toHaveBeenCalled()
  })

  it('locating works even without a seek handler (no beat grid)', async () => {
    const user = userEvent.setup()
    render(
      <ChordChartPanel
        source={source}
        onSourceChange={() => {}}
        onTranspose={() => {}}
        pitchSemitones={0}
        transposedBy={0}
      />,
      { wrapper: I18nTestingProvider }
    )
    await openEditor(user)
    await user.click(
      screen.getByRole('button', {
        name: i18n._('chart.measure-locate', { number: 1 })
      })
    )
    const editor = screen.getByRole('textbox') as HTMLTextAreaElement
    expect(editor.selectionStart).toBe(2)
    expect(editor.selectionEnd).toBe(3)
  })

  it('highlights the measures of the source line under the caret', async () => {
    const user = userEvent.setup()
    renderLocus()
    await openEditor(user)
    const editor = screen.getByRole('textbox') as HTMLTextAreaElement
    // Put the caret on the second line (offset 12 = inside « Am F »).
    editor.setSelectionRange(12, 12)
    fireEvent.select(editor)
    const third = screen.getByRole('button', {
      name: i18n._('chart.measure-locate', { number: 3 })
    })
    const first = screen.getByRole('button', {
      name: i18n._('chart.measure-locate', { number: 1 })
    })
    expect(third).toHaveAttribute('data-active-line')
    expect(first).not.toHaveAttribute('data-active-line')
  })

  it('folding the editor away clears the active-line highlight', async () => {
    const user = userEvent.setup()
    renderLocus()
    await openEditor(user)
    const editor = screen.getByRole('textbox') as HTMLTextAreaElement
    editor.setSelectionRange(12, 12)
    fireEvent.select(editor)
    await user.click(
      screen.getByRole('button', { name: i18n._('chords.edit') })
    )
    // Back to seek buttons, none marked active.
    const second = screen.getByRole('button', {
      name: i18n._('chart.measure-seek', { number: 3 })
    })
    expect(second).not.toHaveAttribute('data-active-line')
  })
})

describe('ChordChartPanel parse feedback (AN.2)', () => {
  function renderPanel(source: string) {
    render(
      <ChordChartPanel
        source={source}
        onSourceChange={() => {}}
        onTranspose={() => {}}
        pitchSemitones={0}
        transposedBy={0}
      />,
      { wrapper: I18nTestingProvider }
    )
  }

  it('shows the measure count while editing', async () => {
    const user = userEvent.setup()
    renderPanel('| C | G |\n| Am |')
    // Folded: the reading view carries no feedback line.
    expect(
      screen.queryByText(i18n._('chords.parse-count', { measures: 3 }))
    ).not.toBeInTheDocument()
    await openEditor(user)
    // Opening focuses the editor, which fires `select` — the feedback counts
    // the caret's line from the first paint (jsdom parks the caret at 0, so
    // line 0's two measures).
    expect(
      screen.getByText(
        i18n._('chords.parse-count-line', { measures: 3, onLine: 2 })
      )
    ).toBeInTheDocument()
  })

  it('falls back to the total when the caret sits on a non-measure line', async () => {
    const user = userEvent.setup()
    renderPanel('| C |\n{d.c.}')
    await openEditor(user)
    const editor = screen.getByRole('textbox') as HTMLTextAreaElement
    editor.setSelectionRange(7, 7)
    fireEvent.select(editor)
    expect(
      screen.getByText(i18n._('chords.parse-count', { measures: 1 }))
    ).toBeInTheDocument()
  })

  it('adds the caret line count once the caret sits on a measure row', async () => {
    const user = userEvent.setup()
    renderPanel('| C | G |\n| Am |')
    await openEditor(user)
    const editor = screen.getByRole('textbox') as HTMLTextAreaElement
    editor.setSelectionRange(12, 12)
    fireEvent.select(editor)
    expect(
      screen.getByText(
        i18n._('chords.parse-count-line', { measures: 3, onLine: 1 })
      )
    ).toBeInTheDocument()
  })

  it('warns about tokens read as chords that cannot be ones', async () => {
    const user = userEvent.setup()
    renderPanel('| C | x3 |')
    await openEditor(user)
    expect(
      screen.getByText(
        i18n._('chords.parse-suspects', { count: 1, examples: 'x3' })
      )
    ).toBeInTheDocument()
  })

  it('warns about measures the unrolled form never plays', async () => {
    const user = userEvent.setup()
    renderPanel('| C | G |\n{fine}\n{d.c.}\n| F |')
    await openEditor(user)
    expect(
      screen.getByText(i18n._('chords.parse-unreachable', { count: 1 }))
    ).toBeInTheDocument()
  })

  it('stays quiet on a healthy grid — counts only, no warnings', async () => {
    const user = userEvent.setup()
    renderPanel('| C | G |')
    await openEditor(user)
    // Caret at the end of the single row: total 2, this line 2.
    expect(
      screen.getByText(
        i18n._('chords.parse-count-line', { measures: 2, onLine: 2 })
      )
    ).toBeInTheDocument()
    expect(document.querySelector('[data-parse-warning]')).toBeNull()
  })

  it('marks the suspect and never-played measures on the sheet while editing', async () => {
    const user = userEvent.setup()
    renderPanel('| C | x3 |\n{fine}\n{d.c.}\n| F |')
    await openEditor(user)
    expect(
      screen.getByRole('button', {
        name: i18n._('chart.measure-locate', { number: 2 })
      })
    ).toHaveAttribute('data-suspect')
    expect(
      screen.getByRole('button', {
        name: i18n._('chart.measure-locate', { number: 3 })
      })
    ).toHaveAttribute('data-unreachable')
    expect(
      screen.getByRole('button', {
        name: i18n._('chart.measure-locate', { number: 1 })
      })
    ).not.toHaveAttribute('data-suspect')
  })

  it('leaves the reading view unmarked — diagnostics are an editing affordance', () => {
    renderPanel('| C | x3 |')
    // Folded, no grid: inert divs, no data-suspect anywhere.
    expect(document.querySelector('[data-suspect]')).toBeNull()
  })
})

describe('ChordChartPanel key read-out (AN.3)', () => {
  function renderKey({
    source = '{key: Eb}\n| Eb | Cm |',
    transposedBy = 0,
    onTranspose = vi.fn(),
    onSourceChange = vi.fn()
  } = {}) {
    render(
      <ChordChartPanel
        source={source}
        onSourceChange={onSourceChange}
        onTranspose={onTranspose}
        pitchSemitones={transposedBy}
        transposedBy={transposedBy}
      />,
      { wrapper: I18nTestingProvider }
    )
    return { onTranspose, onSourceChange }
  }

  it('shows written → current key with the signed offset once transposed', () => {
    renderKey({ transposedBy: 3 })
    // Eb transposed back 3 was written in C; the read-out engraves the flat
    // so the line matches the sheet's B♭-style glyphs (AN.4).
    expect(
      screen.getByText(
        i18n._('chords.key-shift', {
          written: 'C',
          current: 'E♭',
          offset: '+3'
        })
      )
    ).toBeInTheDocument()
  })

  it('falls back to the bare offset when no {key} names the grid', () => {
    renderKey({ source: '| C |', transposedBy: 1 })
    expect(
      screen.getByText(i18n._('chords.key-shift-offset', { offset: '+1' }))
    ).toBeInTheDocument()
  })

  it('stays silent at the written key', () => {
    renderKey({ transposedBy: 0 })
    expect(
      screen.queryByRole('button', { name: i18n._('chords.key-reset') })
    ).not.toBeInTheDocument()
  })

  it('« Revenir à la tonalité écrite » undoes the whole offset', async () => {
    const user = userEvent.setup()
    const { onTranspose } = renderKey({ transposedBy: 3 })
    await user.click(
      screen.getByRole('button', { name: i18n._('chords.key-reset') })
    )
    expect(onTranspose).toHaveBeenCalledWith(-3)
  })

  it('the ♯/♭ toggle re-spells the source without moving any pitch', async () => {
    const user = userEvent.setup()
    const { onSourceChange } = renderKey({ source: '| A# | Dm |' })
    await user.click(
      screen.getByRole('button', { name: i18n._('chords.respell-flat') })
    )
    expect(onSourceChange).toHaveBeenCalledWith('| Bb | Dm |')
    onSourceChange.mockClear()
    await user.click(
      screen.getByRole('button', { name: i18n._('chords.respell-sharp') })
    )
    // The source prop is already sharp-spelled (controlled render): a
    // spelling-identical pass commits nothing — the edit path (and its
    // structure-marker sync) must not re-fire for a visual no-op.
    expect(onSourceChange).not.toHaveBeenCalled()
  })

  it('a respell on a blank grid commits nothing (no marker wipe)', async () => {
    const user = userEvent.setup()
    const { onSourceChange } = renderKey({ source: '' })
    await user.click(
      screen.getByRole('button', { name: i18n._('chords.respell-flat') })
    )
    expect(onSourceChange).not.toHaveBeenCalled()
  })
})

describe('ChordChartPanel roman numerals (AN.5)', () => {
  function renderRoman(source = '{key: C}\n| Dm7 | G7 |') {
    return render(
      <ChordChartPanel
        source={source}
        onSourceChange={vi.fn()}
        onTranspose={vi.fn()}
        pitchSemitones={0}
        transposedBy={0}
      />,
      { wrapper: I18nTestingProvider }
    )
  }

  const toggle = () =>
    screen.getByRole('button', { name: i18n._('chords.roman-toggle') })

  it('starts in letters — roman is an option, off by default', () => {
    renderRoman()
    expect(screen.queryByText('IIm')).not.toBeInTheDocument()
  })

  it('the toggle re-reads the grid as degrees of the named key', async () => {
    const user = userEvent.setup()
    renderRoman()
    await user.click(toggle())
    // AN.5 decision: uppercase numerals, the quality carries the minor.
    expect(screen.getByText('IIm')).toBeInTheDocument()
  })

  it('announces its pressed state — the sheet mode must be perceivable', async () => {
    const user = userEvent.setup()
    renderRoman()
    await user.click(toggle())
    expect(toggle()).toHaveAttribute('aria-pressed', 'true')
  })

  it('toggling back returns the letters', async () => {
    const user = userEvent.setup()
    renderRoman()
    await user.click(toggle())
    await user.click(toggle())
    expect(screen.queryByText('IIm')).not.toBeInTheDocument()
  })

  it('is disabled while no {key} names the grid — no degree without a tonic', () => {
    renderRoman('| Dm7 | G7 |')
    expect(toggle()).toBeDisabled()
  })

  it('the choice sticks — a fresh mount reopens in roman', async () => {
    const user = userEvent.setup()
    const { unmount } = renderRoman()
    await user.click(toggle())
    unmount()
    renderRoman()
    expect(screen.getByText('IIm')).toBeInTheDocument()
  })
})
