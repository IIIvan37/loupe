import type { DetectedSection, MarkerList } from '@app/core'
import { describe, expect, it } from 'vitest'
import { i18n } from '../../i18n/i18n.ts'
import {
  adoptStructureKinds,
  markerSections,
  sectionMarkers
} from './section-markers.ts'

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

describe('adoptStructureKinds', () => {
  it('tags a kind-less section-vocabulary marker as structure', () => {
    // A project saved before marker kinds existed persisted its detected
    // structure markers as plain markers; restored verbatim they read as
    // cues, so the next detection ADDS a fresh set beside them — the
    // duplicated-labels bug. The known section vocabulary adopts its kind.
    const markers: MarkerList = [
      { id: 'a', timeSeconds: 0, label: i18n._('structure.section.intro') },
      { id: 'b', timeSeconds: 12, label: i18n._('structure.section.verse') }
    ]

    expect(adoptStructureKinds(markers).map((m) => m.kind)).toEqual([
      'structure',
      'structure'
    ])
  })

  it('leaves a hand-named cue untouched', () => {
    const markers: MarkerList = [
      { id: 'a', timeSeconds: 3, label: 'Repère 1' },
      { id: 'b', timeSeconds: 7, label: 'Solo à travailler' }
    ]

    expect(adoptStructureKinds(markers)).toEqual(markers)
  })

  it('adopts a raw engine tag an old save carried verbatim', () => {
    // An unknown vocabulary passed through raw at save time (e.g. a label
    // the map did not know then) is still a detection's marker.
    const markers: MarkerList = [{ id: 'a', timeSeconds: 5, label: 'outro' }]

    expect(adoptStructureKinds(markers)[0]?.kind).toBe('structure')
  })
})

describe('markerSections', () => {
  it('reads the structure markers back as sections, cues skipped', () => {
    // The inverse mapping: the labels are ALREADY display copy, carried
    // verbatim; each section runs to the next structure marker's start.
    const markers: MarkerList = [
      { id: 'a', timeSeconds: 12, label: 'Couplet', kind: 'structure' },
      { id: 'b', timeSeconds: 3, label: 'Repère 1' },
      { id: 'c', timeSeconds: 0, label: 'Intro', kind: 'structure' },
      { id: 'd', timeSeconds: 40, label: 'Refrain', kind: 'structure' }
    ]

    expect(markerSections(markers)).toEqual([
      { startSeconds: 0, endSeconds: 12, label: 'Intro' },
      { startSeconds: 12, endSeconds: 40, label: 'Couplet' },
      {
        startSeconds: 40,
        endSeconds: Number.POSITIVE_INFINITY,
        label: 'Refrain'
      }
    ])
  })

  it('yields no section from a cue-only list', () => {
    expect(
      markerSections([{ id: 'a', timeSeconds: 3, label: 'Repère 1' }])
    ).toEqual([])
  })

  it('skips a marker whose label cannot print as a chart header', () => {
    // The rename input trims and forbids empty, but restore() accepts any
    // persisted list verbatim — a blank or multi-line label would print a
    // header parseChart cannot read back, corrupting the draft's round-trip.
    const markers: MarkerList = [
      { id: 'a', timeSeconds: 0, label: '  ', kind: 'structure' },
      { id: 'b', timeSeconds: 4, label: 'Ref\nrain', kind: 'structure' },
      { id: 'c', timeSeconds: 8, label: 'Outro', kind: 'structure' }
    ]

    expect(markerSections(markers)).toEqual([
      {
        startSeconds: 8,
        endSeconds: Number.POSITIVE_INFINITY,
        label: 'Outro'
      }
    ])
  })
})
