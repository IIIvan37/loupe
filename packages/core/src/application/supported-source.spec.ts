import { describe, expect, it } from 'vitest'
import { isSupportedSourceUrl } from './supported-source.ts'

describe('isSupportedSourceUrl', () => {
  it.each([
    'https://www.youtube.com/watch?v=abc',
    'http://youtube.com/watch?v=abc',
    'https://youtube.com/watch?v=abc',
    'https://music.youtube.com/watch?v=abc',
    'https://m.youtube.com/watch?v=abc',
    'https://youtu.be/abc',
    'https://soundcloud.com/artist/track',
    'https://m.soundcloud.com/artist/track'
  ])('accepts a supported host: %s', (url) => {
    expect(isSupportedSourceUrl(url)).toBe(true)
  })

  it.each([
    'https://open.spotify.com/track/xyz',
    'https://deezer.com/track/1',
    'https://vimeo.com/12345',
    'https://youtube.com.evil.example/watch?v=abc',
    'not a url',
    'ftp://youtube.com/watch',
    ''
  ])('rejects an unsupported or malformed URL: %s', (url) => {
    expect(isSupportedSourceUrl(url)).toBe(false)
  })
})
