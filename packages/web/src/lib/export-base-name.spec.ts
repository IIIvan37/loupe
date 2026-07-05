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

  it('strips path separators from a title (defence in depth)', () => {
    expect(exportBaseName('AC/DC \\ Live', undefined)).toBe('AC DC Live')
  })

  it('neutralises a traversal-shaped title', () => {
    const result = exportBaseName('../../etc/passwd', undefined)
    expect(result).not.toContain('/')
    expect(result).not.toContain('..')
  })

  it('drops control characters', () => {
    const result = exportBaseName('a\u0000b\tc', undefined)
    // biome-ignore lint/suspicious/noControlCharactersInRegex: asserting they're gone
    expect(result).not.toMatch(/[\u0000-\u001f]/)
  })

  it('strips filesystem-reserved characters', () => {
    expect(exportBaseName('a:b*c?d"e<f>g|h', undefined)).toBe('a b c d e f g h')
  })

  it('falls back when the title is only unsafe characters', () => {
    expect(exportBaseName('/\\:*', 'song.mp3')).toBe('song')
  })

  it('trims leading dots and spaces', () => {
    expect(exportBaseName('...hidden', undefined)).toBe('hidden')
  })
})
