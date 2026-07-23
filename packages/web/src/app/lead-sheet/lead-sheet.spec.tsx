// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '../../i18n/i18n.ts'
import { I18nTestingProvider } from '../../i18n/i18n-testing-provider.tsx'
import { LeadSheet } from './lead-sheet.tsx'

describe('LeadSheet', () => {
  it('renders a chord of the grid source', () => {
    render(<LeadSheet source={'[Verse]\n| C | Am | F | G |'} />, {
      wrapper: I18nTestingProvider
    })
    expect(screen.getByText('Am')).toBeInTheDocument()
  })

  it('shows a section label as a heading', () => {
    render(<LeadSheet source={'[Verse]\n| C |'} />, {
      wrapper: I18nTestingProvider
    })
    expect(
      screen.getByRole('heading', { name: 'Verse' })
    ).toBeInTheDocument()
  })

  it('renders both chords that share a bar', () => {
    render(<LeadSheet source={'| F G |'} />, {
      wrapper: I18nTestingProvider
    })
    expect(screen.getByText('F')).toBeInTheDocument()
    expect(screen.getByText('G')).toBeInTheDocument()
  })

  it('carries the chosen bars-per-row as the grid CSS variable', () => {
    const { container } = render(
      <LeadSheet source={'| C | Am |'} barsPerRow={6} />,
      { wrapper: I18nTestingProvider }
    )
    expect(
      (container.firstElementChild as HTMLElement).style.getPropertyValue(
        '--bars-per-row'
      )
    ).toBe('6')
  })

  it('marks the measure being played as current', () => {
    render(
      <LeadSheet source={'| C | Am | F |'} currentMeasureIndex={1} />,
      { wrapper: I18nTestingProvider }
    )
    expect(screen.getByText('Am').closest('[aria-current]')).not.toBeNull()
  })

  it('counts the played measure across sections (one global index)', () => {
    render(
      <LeadSheet
        source={'[A]\n| C | Am |\n[B]\n| F |'}
        currentMeasureIndex={2}
      />,
      { wrapper: I18nTestingProvider }
    )
    expect(screen.getByText('F').closest('[aria-current]')).not.toBeNull()
  })

  it('reports the WRITTEN index of a clicked measure (across sections)', async () => {
    const user = userEvent.setup()
    const onSelectMeasure = vi.fn()
    render(
      <LeadSheet
        source={'[A]\n| C | Am |\n[B]\n| F |'}
        onSelectMeasure={onSelectMeasure}
      />,
      { wrapper: I18nTestingProvider }
    )
    await user.click(
      screen.getByRole('button', {
        name: i18n._('chart.measure-seek', { number: 3 })
      })
    )
    expect(onSelectMeasure).toHaveBeenCalledWith(2)
  })

  it('keeps the measures inert without an onSelectMeasure (no lying buttons)', () => {
    render(<LeadSheet source={'| C | Am |'} />, {
      wrapper: I18nTestingProvider
    })
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })

  it('anchors the print region on the sheet root (P.4 print stylesheet)', () => {
    const { container } = render(<LeadSheet source={'| C | Am |'} />, {
      wrapper: I18nTestingProvider
    })
    expect(container.firstElementChild).toHaveAttribute('data-print-region')
  })

  it('emits no print region without a chart — Cmd+P must print the app', () => {
    // The print stylesheet fires on the attribute's PRESENCE; an empty sheet
    // root carrying it would turn every native print into a blank page.
    const { container } = render(<LeadSheet source={''} />, {
      wrapper: I18nTestingProvider
    })
    expect(container.firstElementChild).not.toHaveAttribute(
      'data-print-region'
    )
  })

  it('a form mark alone is no chart — still no print region', () => {
    const { container } = render(<LeadSheet source={'{fine}'} />, {
      wrapper: I18nTestingProvider
    })
    expect(container.firstElementChild).not.toHaveAttribute(
      'data-print-region'
    )
  })

  it('marks nothing while the playhead is before the first bar', () => {
    const { container } = render(<LeadSheet source={'| C | Am |'} />, {
      wrapper: I18nTestingProvider
    })
    expect(container.querySelector('[aria-current]')).toBeNull()
  })

  it('marks nothing when the grid is shorter than the played index', () => {
    const { container } = render(
      <LeadSheet source={'| C | Am |'} currentMeasureIndex={5} />,
      { wrapper: I18nTestingProvider }
    )
    expect(container.querySelector('[aria-current]')).toBeNull()
  })

  it('follows the unrolled form — the repeat pass highlights the top again', () => {
    // |: C | G :| plays C G C G; the third played measure is written measure 0.
    render(
      <LeadSheet source={'|: C | G :|'} currentMeasureIndex={2} />,
      { wrapper: I18nTestingProvider }
    )
    expect(screen.getByText('C').closest('[aria-current]')).not.toBeNull()
  })

  it('marks nothing past the end of the unrolled form', () => {
    const { container } = render(
      <LeadSheet source={'|: C | G :|'} currentMeasureIndex={4} />,
      { wrapper: I18nTestingProvider }
    )
    expect(container.querySelector('[aria-current]')).toBeNull()
  })

  it('draws the |: bar on the measure opening a repeat', () => {
    const { container } = render(<LeadSheet source={'|: C | G :|'} />, {
      wrapper: I18nTestingProvider
    })
    expect(container.querySelector('[data-repeat-start]')).toHaveTextContent(
      'C'
    )
  })

  it('draws the :| bar on the measure closing a repeat', () => {
    const { container } = render(<LeadSheet source={'|: C | G :|'} />, {
      wrapper: I18nTestingProvider
    })
    expect(container.querySelector('[data-repeat-end]')).toHaveTextContent(
      'G'
    )
  })

  it('labels a volta measure with its number bracket', () => {
    render(<LeadSheet source={'|: C |1. G :|\n|2. F |'} />, {
      wrapper: I18nTestingProvider
    })
    expect(screen.getByText('1.')).toBeInTheDocument()
  })

  it('prints the pass count on the bar its :| x3 closes', () => {
    render(<LeadSheet source={'|: C | G :| x3'} />, {
      wrapper: I18nTestingProvider
    })
    expect(screen.getByText('×3')).toBeInTheDocument()
  })

  it('prints the D.C. mark over the measure it follows', () => {
    render(<LeadSheet source={'| C | G |\n{d.c.}'} />, {
      wrapper: I18nTestingProvider
    })
    expect(screen.getByText('D.C.')).toBeInTheDocument()
  })

  it('prints the Fine mark over the measure it follows', () => {
    render(<LeadSheet source={'| C |\n{fine}\n| G |\n{d.c.}'} />, {
      wrapper: I18nTestingProvider
    })
    expect(screen.getByText('Fine')).toBeInTheDocument()
  })

  it('prints the coda sign where the coda starts', () => {
    render(<LeadSheet source={'| C |\n{d.c.}\n{coda}\n| F |'} />, {
      wrapper: I18nTestingProvider
    })
    expect(screen.getByText('⊕')).toBeInTheDocument()
  })

  it('prints the time signature on the measure a {time:} line opens', () => {
    render(<LeadSheet source={'| C | Am |\n{time: 2/4}\n| F |\n| G |'} />, {
      wrapper: I18nTestingProvider
    })
    // Stacked stave notation (2 over 4), named as one signature.
    const sign = screen.getByRole('img', { name: '2/4' })
    expect(sign.closest('[class*="measure"]')).toBe(
      screen.getByText('F').closest('[class*="measure"]')
    )
  })

  it('opens the first system with the stacked session signature', () => {
    // The mockup's notation: the signature is a stacked glyph at the head of
    // the grid (before the first barline), not a "4/4" text in the chart head.
    render(<LeadSheet source={'| C | Am |'} header={{ beatsPerBar: 4 }} />, {
      wrapper: I18nTestingProvider
    })
    expect(screen.getByRole('img', { name: '4/4' })).toBeInTheDocument()
  })

  it('a head {time: …} directive overrides the session signature', () => {
    render(
      <LeadSheet source={'{time: 6/8}\n| C |'} header={{ beatsPerBar: 4 }} />,
      { wrapper: I18nTestingProvider }
    )
    expect(screen.getByRole('img', { name: '6/8' })).toBeInTheDocument()
  })

  it('draws no head signature when no meter is known', () => {
    render(<LeadSheet source={'| C | Am |'} />, {
      wrapper: I18nTestingProvider
    })
    expect(screen.queryByRole('img')).toBeNull()
  })

  it('a {time:} line never becomes a measure of the grid', () => {
    render(<LeadSheet source={'| C |\n{time: 2/4}\n| F |'} currentMeasureIndex={1} />, {
      wrapper: I18nTestingProvider
    })
    expect(screen.getByText('F').closest('[aria-current]')).not.toBeNull()
  })

  it('prints a fermata over a held measure', () => {
    render(<LeadSheet source={'| C@ |'} />, {
      wrapper: I18nTestingProvider
    })
    expect(screen.getByText('𝄐')).toBeInTheDocument()
  })

  it('sets a chord quality as a superscript, engraved (chart typography)', () => {
    const { container } = render(<LeadSheet source={'| Fmaj7 |'} />, {
      wrapper: I18nTestingProvider
    })
    expect(container.querySelector('sup')).toHaveTextContent('M7')
  })

  it('prints the chart head from the source directives', () => {
    render(<LeadSheet source={'{title: Your Song}\n| C |'} />, {
      wrapper: I18nTestingProvider
    })
    expect(
      screen.getByRole('heading', { name: 'Your Song' })
    ).toBeInTheDocument()
  })

  it('prints the session-derived head fields it is given', () => {
    render(<LeadSheet source={'| C |'} header={{ bpm: 128 }} />, {
      wrapper: I18nTestingProvider
    })
    expect(screen.getByText('♩ = 128')).toBeInTheDocument()
  })

  it('an empty grid prints no chart head — nothing to entitle', () => {
    const { container } = render(
      <LeadSheet source={''} header={{ title: 'Nocturne', bpm: 128 }} />,
      { wrapper: I18nTestingProvider }
    )
    expect(container.firstElementChild).toBeEmptyDOMElement()
  })

  it('a directive line never becomes a measure of the grid', () => {
    const { container } = render(
      <LeadSheet source={'{style: pop}\n| C |'} currentMeasureIndex={0} />,
      { wrapper: I18nTestingProvider }
    )
    expect(container.querySelector('[aria-current]')).toHaveTextContent('C')
  })

  describe('playhead follow', () => {
    afterEach(() => {
      vi.restoreAllMocks()
    })

    // jsdom has no layout: fake a 100px scrollport over a 400px sheet and give
    // every measure the same rect — only the CURRENT one takes the follow ref.
    // The port stays DETACHED (assertions read it directly, never via screen)
    // so its content can't leak into the other tests' whole-document queries.
    function scrollport(measureRect: { top: number; height: number }) {
      const port = document.createElement('div')
      port.setAttribute('data-sheet-scrollport', '')
      Object.defineProperty(port, 'clientHeight', { value: 100 })
      Object.defineProperty(port, 'scrollHeight', { value: 400 })
      let scrollTop = 0
      Object.defineProperty(port, 'scrollTop', {
        get: () => scrollTop,
        set: (top: number) => {
          scrollTop = top
        }
      })
      port.getBoundingClientRect = () => ({ top: 0 }) as DOMRect
      vi.spyOn(
        HTMLElement.prototype,
        'getBoundingClientRect'
      ).mockReturnValue(measureRect as DOMRect)
      return port
    }

    it('scrolls ONLY the sheet scrollport to reveal the playing measure', () => {
      const port = scrollport({ top: 240, height: 40 })
      render(<LeadSheet source={'| C | Am |'} currentMeasureIndex={1} />, {
        wrapper: I18nTestingProvider,
        container: port
      })
      // The measure (240–280) aligns to the viewport bottom; the page's own
      // scroll is untouched — the regression was scrollIntoView dragging it.
      expect(port.scrollTop).toBe(180)
    })

    it('leaves the scroll alone when the playing measure is visible', () => {
      const port = scrollport({ top: 20, height: 40 })
      render(<LeadSheet source={'| C | Am |'} currentMeasureIndex={0} />, {
        wrapper: I18nTestingProvider,
        container: port
      })
      expect(port.scrollTop).toBe(0)
    })
  })
})
