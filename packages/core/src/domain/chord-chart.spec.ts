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
})
