import { describe, expect, it } from 'vitest'
import { parseChart } from './chord-chart.ts'

describe('parseChart', () => {
  it('reads a single measure into one unlabelled section', () => {
    expect(parseChart('| C |')).toEqual({
      sections: [{ measures: [{ chords: [{ root: 'C', quality: '' }] }] }]
    })
  })

  it('splits a row into one measure per bar', () => {
    expect(parseChart('| C | Am |')).toEqual({
      sections: [
        {
          measures: [
            { chords: [{ root: 'C', quality: '' }] },
            { chords: [{ root: 'A', quality: 'm' }] }
          ]
        }
      ]
    })
  })

  it('reads space-separated chords within a bar', () => {
    expect(parseChart('| F G |')).toEqual({
      sections: [
        {
          measures: [
            {
              chords: [
                { root: 'F', quality: '' },
                { root: 'G', quality: '' }
              ]
            }
          ]
        }
      ]
    })
  })

  it('labels a section from a bracketed header', () => {
    expect(parseChart('[Verse]\n| C |')).toEqual({
      sections: [
        {
          label: 'Verse',
          measures: [{ chords: [{ root: 'C', quality: '' }] }]
        }
      ]
    })
  })

  it('reads runs of spaces as one separator — no phantom empty chord', () => {
    expect(parseChart('| C   G |')).toEqual({
      sections: [
        {
          measures: [
            {
              chords: [
                { root: 'C', quality: '' },
                { root: 'G', quality: '' }
              ]
            }
          ]
        }
      ]
    })
  })

  it('ignores blank lines before the first header — no empty section', () => {
    expect(parseChart('\n  \n[Intro]\n| C |').sections).toHaveLength(1)
  })

  it('reads an indented header line as a header', () => {
    expect(parseChart('  [Refrain]  \n| C |').sections[0]?.label).toBe(
      'Refrain'
    )
  })

  it('a header must own its whole line — trailing text makes a measure row', () => {
    expect(parseChart('[Intro] | C |').sections[0]?.label).toBeUndefined()
  })

  it('a bracket mid-line is not a header either', () => {
    expect(parseChart('| C | [Coda]').sections[0]?.label).toBeUndefined()
  })
})
