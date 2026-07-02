import { describe, expect, it } from 'vitest'
import { exportBaseName } from './export-base-name.ts'

describe('exportBaseName', () => {
  it('prefers the tag title', () => {
    expect(exportBaseName('Back in Black', 'song.mp3')).toBe('Back in Black')
  })

  it('ignores a blank title (an empty ID3 tag is not nullish)', () => {
    expect(exportBaseName('  ', 'song.mp3')).toBe('song')
  })

  it('strips the file extension from the track name', () => {
    expect(exportBaseName(undefined, 'mon-morceau.flac')).toBe('mon-morceau')
  })

  it('falls back to a generic name when nothing is usable', () => {
    expect(exportBaseName(undefined, undefined)).toBe('stems')
  })
})
