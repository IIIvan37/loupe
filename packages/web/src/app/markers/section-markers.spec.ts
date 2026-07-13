import type { DetectedSection } from '@app/core'
import { describe, expect, it } from 'vitest'
import { i18n } from '../../i18n/i18n.ts'
import { sectionMarkers } from './section-markers.ts'

describe('sectionMarkers', () => {
  it('places a marker at each section start with the translated label', () => {
    const sections: DetectedSection[] = [
      { startSeconds: 0, endSeconds: 12, label: 'intro' },
      { startSeconds: 12, endSeconds: 40, label: 'verse' },
      { startSeconds: 40, endSeconds: 68, label: 'chorus' }
    ]

    expect(sectionMarkers(sections)).toEqual([
      { timeSeconds: 0, label: i18n._('structure.section.intro') },
      { timeSeconds: 12, label: i18n._('structure.section.verse') },
      { timeSeconds: 40, label: i18n._('structure.section.chorus') }
    ])
  })

  it('passes an unknown engine label through verbatim', () => {
    // A vocabulary the map does not know must still land a usable marker.
    expect(
      sectionMarkers([{ startSeconds: 5, endSeconds: 9, label: 'coda' }])
    ).toEqual([{ timeSeconds: 5, label: 'coda' }])
  })
})
