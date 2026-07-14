// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render as renderBare, screen } from '@testing-library/react'
import type { ComponentProps, ReactElement } from 'react'
import { describe, expect, it } from 'vitest'
import { i18n } from '../../i18n/i18n.ts'
import { I18nTestingProvider } from '../../i18n/i18n-testing-provider.tsx'
import { ChartHeader } from './chart-header.tsx'
import { deriveChartHeader } from './derive-chart-header.ts'

const NONE = {}

function render(ui: ReactElement<ComponentProps<typeof ChartHeader>>) {
  return renderBare(ui, { wrapper: I18nTestingProvider })
}

describe('ChartHeader', () => {
  it('shows the derived title as the chart heading', () => {
    render(<ChartHeader derived={{ title: 'Your Song' }} directives={NONE} />)
    expect(
      screen.getByRole('heading', { name: 'Your Song' })
    ).toBeInTheDocument()
  })

  it('a {title: …} directive overrides the derived title', () => {
    render(
      <ChartHeader
        derived={{ title: 'track-tag.mp3' }}
        directives={{ title: 'Your Song' }}
      />
    )
    expect(
      screen.getByRole('heading', { name: 'Your Song' })
    ).toBeInTheDocument()
  })

  it('shows the artist beside the title', () => {
    render(<ChartHeader derived={{ artist: 'Elton John' }} directives={NONE} />)
    expect(screen.getByText('Elton John')).toBeInTheDocument()
  })

  it('prints the key line only when a {key: …} directive names one', () => {
    render(<ChartHeader derived={{}} directives={{ key: 'E♭' }} />)
    expect(
      screen.getByText(i18n._('chart.key-of', { key: 'E♭' }))
    ).toBeInTheDocument()
  })

  it('no key directive, no key line — the app detects no key yet', () => {
    render(<ChartHeader derived={{ title: 'X' }} directives={NONE} />)
    expect(
      screen.queryByText(i18n._('chart.key-of', { key: '' }).trim())
    ).toBeNull()
  })

  it('an empty {key:} directive overrides nothing — no orphan key line', () => {
    render(<ChartHeader derived={{ title: 'X' }} directives={{ key: '' }} />)
    expect(screen.getByRole('banner').childElementCount).toBe(1)
  })

  it('prints the session tempo rounded to the beat', () => {
    render(<ChartHeader derived={{ bpm: 127.6 }} directives={NONE} />)
    expect(screen.getByText('♩ = 128')).toBeInTheDocument()
  })

  it('a {tempo: …} directive overrides the detected BPM', () => {
    render(
      <ChartHeader derived={{ bpm: 127.6 }} directives={{ tempo: '120' }} />
    )
    expect(screen.getByText('♩ = 120')).toBeInTheDocument()
  })

  it('prints the time signature from the grid beats per bar', () => {
    render(<ChartHeader derived={{ beatsPerBar: 3 }} directives={NONE} />)
    expect(screen.getByText('3/4')).toBeInTheDocument()
  })

  it('a {time: …} directive overrides the derived signature', () => {
    render(
      <ChartHeader derived={{ beatsPerBar: 4 }} directives={{ time: '6/8' }} />
    )
    expect(screen.getByText('6/8')).toBeInTheDocument()
    expect(screen.queryByText('4/4')).toBeNull()
  })

  it('prints a {time: …} signature even without a beat grid', () => {
    render(<ChartHeader derived={{}} directives={{ time: '3/4' }} />)
    expect(screen.getByText('3/4')).toBeInTheDocument()
  })

  it('shows the {style: …} directive as the meta line', () => {
    render(<ChartHeader derived={{}} directives={{ style: 'pop ballad' }} />)
    expect(screen.getByText('pop ballad')).toBeInTheDocument()
  })

  it('renders nothing at all without any header data', () => {
    const { container } = render(<ChartHeader derived={{}} directives={NONE} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('deriveChartHeader', () => {
  it('prefers the tag title, then the file name — like the app header', () => {
    expect(
      deriveChartHeader({ artist: 'Elton John' }, 'your-song', {
        bpm: 127.6,
        beatsPerBar: 4
      })
    ).toEqual({
      title: 'your-song',
      artist: 'Elton John',
      bpm: 127.6,
      beatsPerBar: 4
    })
  })

  it('derives no placeholder — an untagged track prints a blank head', () => {
    expect(deriveChartHeader({}, null, undefined)).toEqual({
      title: undefined,
      artist: undefined,
      bpm: undefined,
      beatsPerBar: undefined
    })
  })
})
